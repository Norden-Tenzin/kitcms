// Better Auth on Workers + D1 (Phase 0 spike). The instance is built lazily, once per isolate.
// Security-critical: public sign-up is disabled; the first admin is created server-side only.
import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { getRequestEvent } from '$app/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { drizzle } from 'drizzle-orm/d1';
import { ROLES } from './auth-guard';

export interface KitcmsAuthOptions {
	/**
	 * The Drizzle tables for Better Auth's `user`, `session`, `account` and `verification` models
	 * (generated into the app as `drizzle/auth-schema.ts`).
	 */
	schema: Record<string, unknown>;
	/**
	 * Better Auth's `session.cookieCache`: a signed cookie that lets the session resolve without a D1
	 * read for `maxAge` seconds. Off by default: a revoked session or changed role would stay valid
	 * for up to `maxAge` seconds.
	 */
	cookieCache?: false | { maxAge: number };
	/** Log every auth D1 statement to the console (spike measurement only). */
	debugSql?: boolean;
}

interface AuthEnv {
	DB: D1Database;
	BETTER_AUTH_SECRET?: string;
	BETTER_AUTH_URL?: string;
}

function createAuth(options: KitcmsAuthOptions) {
	const e = env as unknown as AuthEnv;
	const secret = e.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error(
			'kitcms: BETTER_AUTH_SECRET is not set. Add it to .dev.vars (local) or `wrangler secret put BETTER_AUTH_SECRET` (deployed).',
		);
	}
	const db = drizzle(e.DB, {
		schema: options.schema,
		logger: options.debugSql
			? { logQuery: (query) => console.log(`[kitcms:sql] ${query.split('\n')[0]}`) }
			: undefined,
	});
	return betterAuth({
		secret,
		// Unset: Better Auth derives the origin from each request (the Worker is only reachable on its own hosts).
		baseURL: e.BETTER_AUTH_URL || undefined,
		database: drizzleAdapter(db, { provider: 'sqlite', schema: options.schema }),
		emailAndPassword: {
			enabled: true,
			// Public sign-up is closed. The first admin is created by the `createFirstUser` admin action
			// through the internal adapter (see `createFirstAdmin`), never through /api/auth/sign-up/email.
			disableSignUp: true,
			minPasswordLength: 8,
		},
		user: {
			additionalFields: {
				role: {
					type: 'string',
					required: true,
					defaultValue: 'editor',
					// Never settable from a client request (sign-up, update-user).
					input: false,
				},
			},
		},
		session: {
			cookieCache: options.cookieCache
				? { enabled: true, maxAge: options.cookieCache.maxAge }
				: { enabled: false },
		},
		advanced: {
			// Cloudflare's header is the trustworthy client IP behind its edge.
			ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
			defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
			// Without a baseURL Better Auth can't tell it is on https (NODE_ENV is absent on Workers) and would
			// omit Secure. Deployed Workers are always https, so fail closed: only `vite dev` (http) is insecure.
			useSecureCookies: !dev,
		},
		// Must be last: copies Set-Cookie from server-side `auth.api.*` calls onto the SvelteKit response.
		plugins: [sveltekitCookies(getRequestEvent)],
	});
}

export type KitcmsAuth = ReturnType<typeof createAuth>;

let configured: KitcmsAuthOptions | undefined;
let instance: KitcmsAuth | undefined;

/** Called once by `kitcms({ auth })`. Does not build the instance. */
export function configureAuth(options: KitcmsAuthOptions): void {
	configured = options;
}

export function authConfigured(): boolean {
	return configured !== undefined;
}

/** The Better Auth instance for this isolate, built on first use. Throws if the secret is missing. */
export function getAuth(): KitcmsAuth {
	if (!configured) throw new Error('kitcms: auth is not configured. Pass `auth` to kitcms({ ... }).');
	instance ??= createAuth(configured);
	return instance;
}

export function isAuthPath(pathname: string): boolean {
	return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

export async function countUsers(): Promise<number> {
	const ctx = await getAuth().$context;
	return ctx.internalAdapter.countTotalUsers();
}

export class FirstUserError extends Error {
	constructor(
		readonly code: 'USERS_EXIST' | 'INVALID' | 'RACE',
		message: string,
	) {
		super(message);
	}
}

/**
 * Creates the first admin. Re-checks "zero users" itself (the caller's check is not trusted), writes
 * through Better Auth's internal adapter (public sign-up stays disabled), and undoes its own insert if a
 * concurrent request also created a user (D1 has no interactive transactions).
 */
export async function createFirstAdmin(input: {
	name: string;
	email: string;
	password: string;
}): Promise<void> {
	const ctx = await getAuth().$context;
	const email = input.email.trim().toLowerCase();
	const name = input.name.trim();
	if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		throw new FirstUserError('INVALID', 'Enter a name and a valid email.');
	}
	const { minPasswordLength, maxPasswordLength } = ctx.password.config;
	if (input.password.length < minPasswordLength || input.password.length > maxPasswordLength) {
		throw new FirstUserError(
			'INVALID',
			`Password must be ${minPasswordLength} to ${maxPasswordLength} characters.`,
		);
	}
	if ((await ctx.internalAdapter.countTotalUsers()) > 0) {
		throw new FirstUserError('USERS_EXIST', 'The first user already exists.');
	}
	const hash = await ctx.password.hash(input.password);
	const user = await ctx.internalAdapter.createUser({
		name,
		email,
		emailVerified: false,
		role: ROLES[0],
	}, { method: 'email-password' });
	try {
		await ctx.internalAdapter.linkAccount({
			userId: user.id,
			providerId: 'credential',
			accountId: user.id,
			password: hash,
		});
		if ((await ctx.internalAdapter.countTotalUsers()) > 1) {
			throw new FirstUserError('RACE', 'The first user already exists.');
		}
	} catch (err) {
		await ctx.internalAdapter.deleteUser(user.id);
		throw err;
	}
}
