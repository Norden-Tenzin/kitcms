// Better Auth on Workers + D1, wired to the kitcms tables (plan §4.7). The instance is built lazily,
// once per isolate per config (per Secure-cookie mode). Security-critical: public sign-up is
// disabled; the first admin and all later users are created server-side only (./users.ts).
//
// Uses `better-auth/minimal` (no Kysely in the bundle; Decision 18) with the Drizzle adapter.
import { dev } from '$app/env';
import { basePath } from '../sveltekit/base';
import { getRequestEvent } from '$app/server';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { drizzle } from 'drizzle-orm/d1';
import type { KitcmsInternals } from '../sveltekit/index';
import { getTables } from '../schema/drizzle';
import { AUTH_TABLES } from '../schema/spec';
import { ulid } from '../ulid';
import { authBasePath, parseBaseOrigin, useSecureCookies } from './cookies';
import { SIGN_IN_RULE } from './rate-limit';


export function getD1(k: Pick<KitcmsInternals, 'config' | 'env'>): D1Database {
	const binding = k.env[k.config.bindings.db] as D1Database | undefined;
	if (!binding) throw new Error(`kitcms: the D1 binding "${k.config.bindings.db}" is missing.`);
	return binding;
}

function createAuth(k: KitcmsInternals, secure: boolean) {
	const secret = k.env.BETTER_AUTH_SECRET;
	if (typeof secret !== 'string' || !secret) {
		throw new Error(
			'kitcms: BETTER_AUTH_SECRET is not set. Add it to .dev.vars (local) or `wrangler secret put BETTER_AUTH_SECRET` (deployed).',
		);
	}
	const { config } = k;
	const tables = getTables(config);
	// Auth deliberately uses the RAW D1 binding, not a replica session: sessions and sign-in must
	// read their own latest writes, so they go to the primary (§13.10). Content reads use `k.db`.
	const db = drizzle(getD1(k));
	const cookieCache = k.options.auth?.cookieCache;
	const baseOrigin = parseBaseOrigin(k.env.BETTER_AUTH_URL);

	return betterAuth({
		secret,
		// Unset: Better Auth derives the origin from each request (the Worker is only reachable on its own hosts).
		baseURL: baseOrigin?.origin,
		basePath: authBasePath(basePath()),
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: {
				user: tables[config.authCollection],
				session: tables[AUTH_TABLES.session],
				account: tables[AUTH_TABLES.account],
				verification: tables[AUTH_TABLES.verification],
				rateLimit: tables[AUTH_TABLES.rateLimit],
			},
		}),
		emailAndPassword: {
			enabled: true,
			// Public sign-up is closed: users are created by kitcms's own flows (./users.ts), never
			// through /api/auth/sign-up/email.
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
			cookieCache: cookieCache ? { enabled: true, maxAge: cookieCache.maxAge } : { enabled: false },
		},
		rateLimit: {
			enabled: true,
			// Per-isolate memory is useless on Workers: counters live in D1.
			storage: 'database',
			window: 60,
			max: 100,
			customRules: { '/sign-in/email': { window: SIGN_IN_RULE.window, max: SIGN_IN_RULE.max } },
		},
		advanced: {
			// Cloudflare's header is the trustworthy client IP behind its edge.
			ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
			defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
			// Without a baseURL Better Auth can't tell it is on https (NODE_ENV is absent on Workers) and
			// would omit Secure, so decide explicitly. See `useSecureCookies`.
			useSecureCookies: secure,
			database: { generateId: () => ulid() },
		},
		// Must be last: copies Set-Cookie from server-side `auth.api.*` calls onto the SvelteKit response.
		plugins: [sveltekitCookies(getRequestEvent)],
	});
}

export type KitcmsAuth = ReturnType<typeof createAuth>;

interface Entry {
	binding: D1Database;
	secure?: KitcmsAuth;
	insecure?: KitcmsAuth;
}
const instances = new WeakMap<object, Entry>();

function currentRequestUrl(): URL | null {
	try {
		return getRequestEvent().url;
	} catch {
		return null; // not inside a request
	}
}

/**
 * The Better Auth instance for this isolate and config, built on first use. Throws if the secret is
 * missing. `requestUrl` decides the Secure-cookie mode (defaults to the current request, else secure).
 */
export function getAuth(k: KitcmsInternals, requestUrl: URL | null = currentRequestUrl()): KitcmsAuth {
	const origin = parseBaseOrigin(k.env.BETTER_AUTH_URL) ?? requestUrl;
	const secure = useSecureCookies({ dev, origin });
	const binding = getD1(k);
	let entry = instances.get(k.config);
	// A different D1 binding (tests, or a hot-reloaded dev worker) invalidates the cached instances.
	if (!entry || entry.binding !== binding) {
		entry = { binding };
		instances.set(k.config, entry);
	}
	if (secure) return (entry.secure ??= createAuth(k, true));
	return (entry.insecure ??= createAuth(k, false));
}
