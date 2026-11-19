// The auth operations the admin actions need, as result values instead of exceptions.
// Lazy-loaded by ../sveltekit/admin.ts (public routes never load Better Auth).
import { adminAccess } from '../access/engine';
import { FORM } from '../admin/types';
import type { KitcmsUser } from '../config/hooks';
import { ForbiddenError, isKitcmsError, ValidationError } from '../errors';
import type { KitcmsInternals } from '../sveltekit/index';
import { decideAdminAccess as decide, type GuardDecision } from './guard';
import {
	PasswordTokenError,
	requestPasswordReset,
	resetPasswordWithToken,
	sendInvite,
	type PasswordLink,
} from './password-tokens';
import {
	authContext,
	countUsers,
	createFirstAdmin as createFirst,
	createUserWithPassword as createUser,
	FirstUserError,
	setPassword as setPw,
	signIn as signInRaw,
	SignInError,
	signOut,
} from './users';

export { countUsers, signOut };

export type Result = { ok: true } | { ok: false; status: number; message: string };

export function decideAdminAccess(input: {
	view: string;
	signedIn: boolean;
	canUseAdmin: boolean;
	userCount: number;
}): GuardDecision {
	return decide({
		view: input.view,
		user: input.signedIn ? {} : null,
		canUseAdmin: input.canUseAdmin,
		userCount: input.userCount,
	});
}

/**
 * Signs in for the admin. A user without admin access (`access.admin` / role) is refused and the
 * session just created for them is revoked, so a non-admin account never holds an admin session.
 */
export async function signIn(
	k: KitcmsInternals,
	input: { email: string; password: string; headers: Headers },
): Promise<Result> {
	let user: KitcmsUser;
	try {
		user = await signInRaw(k, input);
	} catch (err) {
		if (err instanceof SignInError) {
			return { ok: false, status: err.code === 'RATE_LIMITED' ? 429 : 400, message: err.message };
		}
		throw err;
	}
	const allowed = await adminAccess(k.config, { user, context: {}, cms: k.cms, source: 'admin' });
	if (!allowed) {
		const ctx = await authContext(k);
		for (const s of await ctx.internalAdapter.listSessions(user.id)) {
			await ctx.internalAdapter.deleteSession(s.token);
		}
		return { ok: false, status: 403, message: 'This account does not have access to the admin.' };
	}
	return { ok: true };
}

export async function createFirstAdmin(
	k: KitcmsInternals,
	input: { name: string; email: string; password: string },
): Promise<Result> {
	try {
		await createFirst(k, input);
		return { ok: true };
	} catch (err) {
		if (err instanceof FirstUserError) {
			return { ok: false, status: err.code === 'INVALID' ? 400 : 403, message: err.message };
		}
		throw err;
	}
}

/** Creates a user with a password (admin "create" view of the auth collection). Throws pipeline errors. */
export async function createUserWithPassword(
	k: KitcmsInternals,
	data: Record<string, unknown> & { password: string },
): Promise<{ id: string }> {
	try {
		return await createUser(k, {
			...data,
			email: String(data.email ?? ''),
			name: String(data.name ?? ''),
		});
	} catch (err) {
		// The password input is named FORM.password in the admin form.
		if (err instanceof ValidationError) {
			throw new ValidationError(
				err.errors.map((e) => (e.path === 'password' ? { ...e, path: FORM.password } : e)),
				err.message,
			);
		}
		throw err;
	}
}

export async function setPassword(
	k: KitcmsInternals,
	input: { userId: string; newPassword: string; currentPassword?: string; headers: Headers },
): Promise<Result> {
	try {
		await setPw(k, input);
		return { ok: true };
	} catch (err) {
		if (err instanceof ValidationError) return { ok: false, status: 400, message: err.errors[0]?.message ?? err.message };
		if (err instanceof ForbiddenError || isKitcmsError(err)) {
			return { ok: false, status: (err as ForbiddenError).status, message: (err as Error).message };
		}
		throw err;
	}
}

// ---------------------------------------------------------------------------------------------
// Password links (Decision 37)
// ---------------------------------------------------------------------------------------------

export { peekPasswordToken } from './password-tokens';

export async function forgotPassword(
	k: KitcmsInternals,
	input: { email: string; ip: string | null; link: PasswordLink; title: string },
): Promise<Result> {
	const outcome = await requestPasswordReset(k, input);
	if (outcome === 'rate-limited') return { ok: false, status: 429, message: 'Too many requests. Try again later.' };
	if (outcome === 'email-off') return { ok: false, status: 503, message: 'Email is not set up for this site, so a reset link cannot be sent. Ask an admin to set a new password.' };
	return { ok: true };
}

export async function resetPassword(
	k: KitcmsInternals,
	input: { token: string; newPassword: string; ip: string | null },
): Promise<{ ok: true; email: string } | { ok: false; status: number; message: string }> {
	try {
		const { email } = await resetPasswordWithToken(k, input);
		return { ok: true, email };
	} catch (err) {
		if (err instanceof ValidationError) return { ok: false, status: 400, message: err.errors[0]?.message ?? err.message };
		if (err instanceof PasswordTokenError) return { ok: false, status: err.code === 'RATE_LIMITED' ? 429 : 400, message: err.message };
		throw err;
	}
}

/**
 * The admin "create user" flow with an invite instead of a password: the row is created with the
 * CALLER's access (as in `createUserWithPassword`), then a set-password link is emailed. If the
 * email can't be sent the new user is deleted again, so nobody is left without a way in.
 */
export async function createUserWithInvite(
	k: KitcmsInternals,
	data: Record<string, unknown>,
	opts: { link: PasswordLink; title: string },
): Promise<{ id: string }> {
	if (!k.email.enabled) {
		throw new ValidationError([{ path: FORM.invite, message: 'Email is not set up, so invites cannot be sent. Set a password instead.' }]);
	}
	const doc = (await k.cms.create(k.config.authCollection, { ...data, email: String(data.email ?? '').trim().toLowerCase() })) as {
		id: string;
	};
	try {
		await sendInvite(k, doc.id, opts);
	} catch (err) {
		await k.cmsFor(null).delete(k.config.authCollection, doc.id, { overrideAccess: true }).catch(() => {});
		throw err;
	}
	return { id: doc.id };
}
