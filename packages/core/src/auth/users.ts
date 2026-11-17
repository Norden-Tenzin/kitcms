// User and credential management on top of Better Auth's internal adapter (plan §4.7).
// Security-critical. Users are created through the kitcms pipeline (validation + hooks run) and then
// linked to a `credential` account holding the Better Auth password hash. There is no public sign-up.
import { getRequestEvent } from '$app/server';
import { drizzle } from 'drizzle-orm/d1';
import { isAdmin } from '../access/engine';
import type { KitcmsUser } from '../config/hooks';
import { ForbiddenError, ValidationError } from '../errors';
import { getTables } from '../schema/drizzle';
import { AUTH_TABLES } from '../schema/spec';
import type { KitcmsInternals } from '../sveltekit/index';
import { getAuth, getD1 } from './better-auth';
import { checkSignInRateLimit, consume, normalizeEmail, type AuthDb, type RateRule } from './rate-limit';
import { toKitcmsUser } from './session';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function authContext(k: KitcmsInternals) {
	return getAuth(k).$context;
}

type Ctx = Awaited<ReturnType<typeof authContext>>;

function authDb(k: KitcmsInternals): AuthDb {
	return drizzle(getD1(k)) as unknown as AuthDb;
}

function passwordProblem(ctx: Ctx, password: unknown): string | null {
	const { minPasswordLength, maxPasswordLength } = ctx.password.config;
	if (typeof password !== 'string' || password.length < minPasswordLength || password.length > maxPasswordLength) {
		return `Password must be ${minPasswordLength} to ${maxPasswordLength} characters.`;
	}
	return null;
}

export async function countUsers(k: KitcmsInternals): Promise<number> {
	return k.cmsFor(null).count(k.config.authCollection, { overrideAccess: true });
}

/** Removes a half-created user (FK cascade removes its accounts and sessions). Never throws. */
async function rollbackUser(k: KitcmsInternals, ctx: Ctx, id: string): Promise<void> {
	try {
		await k.cmsFor(null).delete(k.config.authCollection, id, { overrideAccess: true });
	} catch {
		try {
			await ctx.internalAdapter.deleteUser(id);
		} catch {
			// nothing more we can do; the caller's error is the one that matters
		}
	}
}

// ---------------------------------------------------------------------------------------------
// First admin
// ---------------------------------------------------------------------------------------------

export class FirstUserError extends Error {
	constructor(
		readonly code: 'USERS_EXIST' | 'INVALID' | 'RACE',
		message: string,
	) {
		super(message);
		this.name = 'FirstUserError';
	}
}

/**
 * Creates the first admin. Re-checks "zero users" itself (the caller's check is not trusted), creates
 * the row through the kitcms pipeline as a trusted system write (validation and hooks run), links the
 * credential account, and undoes its own insert if a concurrent request also created a user (D1 has no
 * interactive transactions; on a race both requests roll back and fail, which is the safe outcome).
 */
export async function createFirstAdmin(
	k: KitcmsInternals,
	input: { name: string; email: string; password: string },
): Promise<void> {
	const ctx = await authContext(k);
	const email = normalizeEmail(String(input.email ?? ''));
	const name = String(input.name ?? '').trim();
	if (!name || !EMAIL_RE.test(email)) throw new FirstUserError('INVALID', 'Enter a name and a valid email.');
	const problem = passwordProblem(ctx, input.password);
	if (problem) throw new FirstUserError('INVALID', problem);
	if ((await countUsers(k)) > 0) throw new FirstUserError('USERS_EXIST', 'The first user already exists.');

	const hash = await ctx.password.hash(input.password);
	const slug = k.config.authCollection;
	let user: { id: string };
	try {
		user = (await k.cmsFor(null).create(slug, { name, email, role: 'admin' }, { overrideAccess: true })) as {
			id: string;
		};
	} catch (err) {
		if (err instanceof ValidationError) {
			throw new FirstUserError('INVALID', err.errors[0]?.message ?? 'Invalid user.');
		}
		throw err;
	}
	try {
		await ctx.internalAdapter.linkAccount({
			userId: user.id,
			providerId: 'credential',
			accountId: user.id,
			password: hash,
		});
		if ((await countUsers(k)) > 1) throw new FirstUserError('RACE', 'The first user already exists.');
	} catch (err) {
		await rollbackUser(k, ctx, user.id);
		throw err;
	}
}

// ---------------------------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------------------------

export class SignInError extends Error {
	constructor(
		readonly code: 'INVALID_CREDENTIALS' | 'RATE_LIMITED',
		message: string,
		/** Seconds, for `RATE_LIMITED`. */
		readonly retryAfter = 0,
	) {
		super(message);
		this.name = 'SignInError';
	}
}

/**
 * Signs in with email + password (sets the session cookie through Better Auth's SvelteKit plugin) and
 * returns the user. Rate-limited per IP and per email (server-side `auth.api` calls skip Better Auth's
 * own limiter), failing closed on DB errors. Wrong email and wrong password are indistinguishable.
 *
 * The caller MUST then check `adminAccess` for the returned user and sign out if it is not allowed.
 */
export async function signIn(
	k: KitcmsInternals,
	input: { email: string; password: string; headers: Headers },
): Promise<KitcmsUser> {
	const email = normalizeEmail(input.email);
	const tables = getTables(k.config);
	const limit = await checkSignInRateLimit(authDb(k), tables[AUTH_TABLES.rateLimit]!, {
		ip: input.headers.get('cf-connecting-ip'),
		email,
	});
	if (!limit.allowed) {
		throw new SignInError('RATE_LIMITED', 'Too many attempts. Try again later.', limit.retryAfter);
	}
	const auth = getAuth(k);
	let result: { user: Record<string, unknown> };
	try {
		result = (await auth.api.signInEmail({
			body: { email, password: input.password },
			headers: input.headers,
		})) as unknown as { user: Record<string, unknown> };
	} catch (err) {
		// Better Auth's APIError (4xx) = bad credentials. Anything else (D1 down, ...) must surface.
		const status = (err as { statusCode?: unknown; status?: unknown } | null)?.statusCode;
		if ((err as Error | null)?.name === 'APIError' && typeof status === 'number' && status < 500) {
			throw new SignInError('INVALID_CREDENTIALS', 'Invalid email or password.');
		}
		throw err;
	}
	return toKitcmsUser(result.user, k.config.authCollection, k.config.tenancy ? k.config.tenancy.userField : undefined);
}

export async function signOut(k: KitcmsInternals, headers: Headers): Promise<void> {
	await getAuth(k).api.signOut({ headers });
}

// ---------------------------------------------------------------------------------------------
// Admin-managed users and passwords
// ---------------------------------------------------------------------------------------------

/**
 * The admin "create user" flow. The row is created with the CALLER's access (`k.cms`: by default only
 * admins may create users, and only admins may set `role`), then linked to a credential account.
 * If linking fails the new user is deleted.
 */
export async function createUserWithPassword(
	k: KitcmsInternals,
	data: Record<string, unknown> & { email: string; name: string; password: string },
): Promise<{ id: string }> {
	const ctx = await authContext(k);
	const { password, ...rest } = data;
	const problem = passwordProblem(ctx, password);
	if (problem) throw new ValidationError([{ path: 'password', message: problem }]);
	const slug = k.config.authCollection;
	const doc = (await k.cms.create(slug, { ...rest, email: normalizeEmail(String(rest.email ?? '')) })) as {
		id: string;
	};
	try {
		const hash = await ctx.password.hash(password);
		await ctx.internalAdapter.linkAccount({
			userId: doc.id,
			providerId: 'credential',
			accountId: doc.id,
			password: hash,
		});
	} catch (err) {
		await rollbackUser(k, ctx, doc.id);
		throw err;
	}
	return { id: doc.id };
}

const SET_PASSWORD_RULE: RateRule = { max: 5, window: 60 };

/**
 * Sets a user's password. Admins may set other users' passwords; anyone (admins included) may set
 * their own only with the correct `currentPassword`. Everyone else gets `ForbiddenError`. Afterwards the target's other sessions are
 * revoked (all of them when the target isn't the caller, or when the caller's session can't be
 * identified; `headers` defaults to the current request's).
 */
export async function setPassword(
	k: KitcmsInternals,
	input: { userId: string; newPassword: string; currentPassword?: string; headers?: Headers },
): Promise<void> {
	const actor = k.user;
	if (!actor) throw new ForbiddenError();
	const ctx = await authContext(k);
	const self = actor.id === input.userId;
	const admin = isAdmin(actor);
	if (!admin && !self) throw new ForbiddenError();

	const problem = passwordProblem(ctx, input.newPassword);
	if (problem) throw new ValidationError([{ path: 'newPassword', message: problem }]);

	const accounts = await ctx.internalAdapter.findAccounts(input.userId);
	const credential = accounts.find((a) => a.providerId === 'credential');

	if (self) {
		// A signed-in session alone isn't enough to change one's own password (stolen cookie),
		// for admins too. Admins set OTHER users' passwords without it.
		const tables = getTables(k.config);
		const limit = await consume(
			authDb(k),
			tables[AUTH_TABLES.rateLimit]!,
			`kitcms:setpw:user:${actor.id}`,
			SET_PASSWORD_RULE,
		);
		if (!limit.allowed) throw new ForbiddenError('Too many attempts. Try again later.');
		const ok =
			typeof input.currentPassword === 'string' &&
			credential?.password != null &&
			(await ctx.password.verify({ hash: credential.password, password: input.currentPassword }));
		if (!ok) throw new ForbiddenError('The current password is incorrect.');
	}

	const hash = await ctx.password.hash(input.newPassword);
	if (credential) await ctx.internalAdapter.updatePassword(input.userId, hash);
	else {
		await ctx.internalAdapter.linkAccount({
			userId: input.userId,
			providerId: 'credential',
			accountId: input.userId,
			password: hash,
		});
	}

	let keep: string | null = null;
	if (self) {
		const headers = input.headers ?? currentHeaders();
		if (headers) {
			const current = await getAuth(k).api.getSession({ headers });
			if (current?.user.id === input.userId) keep = current.session.token;
		}
	}
	const sessions = await ctx.internalAdapter.listSessions(input.userId);
	for (const s of sessions) {
		if (s.token !== keep) await ctx.internalAdapter.deleteSession(s.token);
	}
}

function currentHeaders(): Headers | null {
	try {
		return getRequestEvent().request.headers;
	} catch {
		return null; // not inside a request
	}
}
