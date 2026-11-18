// kitcms's SvelteKit integration (plan §4.1, §4.7).
//
//   // src/hooks.server.ts
//   import { kitcms } from '@kitcms/core/sveltekit';
//   import config from './kitcms.config';
//   export const handle = kitcms({ config }).handle;
//
// `handle` puts the Local API on `locals.cms` (acting as the request's user), serves Better Auth
// under `<base>/api/auth/*`, and resolves the session for `<base>/admin*` and `<base>/api*` only:
// public routes run no auth code and no auth SQL (auth is lazy-loaded, Decision 18).
// Package route modules (admin, REST) get their untyped handles via `getKitcms(locals)`.

import * as workers from 'cloudflare:workers';
import { basePath } from './base';
import type { Handle } from '@sveltejs/kit/hooks';
import type { LocalAPI } from '../api/types';
import { createLocalApi } from '../api/local';
import type { Cms } from '../api/types';
import type { Config } from '../config/collection';
import type { KitcmsUser } from '../config/hooks';
import type { SanitizedConfig } from '../config/sanitized';
import { sanitizeConfig } from '../config/sanitize';
import type { DbAdapter } from '../db/adapter';
import { dev } from '$app/env';
import { parseBaseOrigin, useSecureCookies } from '../auth/cookies';
import { readBookmarkCookie, serializeBookmarkCookie, sessionStartFor } from '../db/session';
import { dbFor, storageFor } from '../runtime';
import type { StorageAdapter } from '../storage/adapter';
import { needsSession, stripBase } from './paths';

export type { KitcmsUser } from '../config/hooks';

/** The current session. Deliberately has no token: the cookie is the only place it is visible. */
export interface KitcmsSession {
	id: string;
	expiresAt: Date;
}

declare global {
	namespace App {
		interface Locals {
			/** The Local API, typed by the config registered in `app.d.ts` (see `Register`). */
			cms: LocalAPI;
			/** Only resolved for /admin and /api requests; `null` on public routes and when signed out. */
			user: KitcmsUser | null;
			session: KitcmsSession | null;
		}
	}
}

export interface KitcmsAuthOptions {
	/**
	 * Better Auth's `session.cookieCache`: a signed cookie that lets the session resolve without a
	 * D1 read for `maxAge` seconds. Off by default: a revoked session or changed role would stay
	 * valid for up to `maxAge` seconds.
	 */
	cookieCache?: false | { maxAge: number };
}

export interface KitcmsOptions {
	config: Config;
	auth?: KitcmsAuthOptions;
}

/** @internal Per-request internals for package route modules. Not semver-covered (plan §16.2). */
export interface KitcmsInternals {
	config: SanitizedConfig;
	options: KitcmsOptions;
	db: DbAdapter;
	env: Record<string, unknown>;
	/** `locals.cms`, typed against the untyped config. */
	cms: Cms;
	user: KitcmsUser | null;
	/** Builds a Local API acting as another user (e.g. right after sign-in). */
	cmsFor(user: KitcmsUser | null, source?: 'local' | 'admin' | 'rest'): Cms;
	/** R2 adapter; `undefined` when no collection has `upload`. */
	storage?: StorageAdapter;
}

const internals = new WeakMap<App.Locals, KitcmsInternals>();

/** @internal The kitcms handles for a request (package route modules only, plan §16.2). Throws if `kitcms().handle` didn't run. */
export function getKitcms(locals: App.Locals): KitcmsInternals {
	const k = internals.get(locals);
	if (!k) throw new Error('kitcms: `kitcms({ config }).handle` is not installed in hooks.server.ts.');
	return k;
}


const waitUntil = (workers as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil;

export function kitcms(options: KitcmsOptions): { handle: Handle; config: SanitizedConfig } {
	const config = sanitizeConfig(options.config);

	return {
		config,
		handle: async ({ event, resolve }) => {
			const env = workers.env as unknown as Record<string, unknown>;
			// Anonymous until a user resolves: nearest replica (§13.10). Signed-in requests re-open below.
			let db = dbFor(config, env, 'first-unconstrained');
			const pathname = stripBase(event.url.pathname, basePath(event.url));
			const storage = storageFor(config, env, basePath);

			const cmsFor = (user: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') =>
				createLocalApi({ config, db, storage, user, source, event, waitUntil });

			event.locals.user = null;
			event.locals.session = null;
			let k: KitcmsInternals = {
				config,
				options,
				db,
				env,
				cms: cmsFor(null),
				user: null,
				cmsFor,
				storage: storage as StorageAdapter | undefined,
			};
			internals.set(event.locals, k);
			event.locals.cms = k.cms as unknown as LocalAPI;

			let signedIn = false;
			let cookieBookmark: string | null = null;
			if (pathname !== null && needsSession(pathname)) {
				// Lazy: public requests never evaluate Better Auth (Decision 18).
				const auth = await import('../auth/module');
				if (auth.isAuthPath(pathname)) return auth.handleAuthRoute(event, resolve, k);
				const resolved = await auth.resolveSession(event, k);
				if (resolved) {
					event.locals.user = resolved.user;
					event.locals.session = resolved.session;
					// Signed in: sequential consistency via the bookmark cookie, else the primary.
					cookieBookmark = readBookmarkCookie(event.request.headers.get('cookie'));
					db = dbFor(config, env, sessionStartFor({ signedIn: true, bookmark: cookieBookmark }));
					signedIn = true;
					k = { ...k, db, user: resolved.user, cms: cmsFor(resolved.user) };
					internals.set(event.locals, k);
					event.locals.cms = k.cms as unknown as LocalAPI;
				}
			}
			const response = await resolve(event);
			// Only signed-in /admin and /api requests ever set the cookie; public pages never do.
			const bookmark = signedIn ? (db.bookmark?.() ?? null) : null;
			if (!bookmark || bookmark === cookieBookmark) return response;
			const origin = parseBaseOrigin(env.BETTER_AUTH_URL) ?? event.url;
			const cookie = serializeBookmarkCookie(bookmark, {
				base: basePath(event.url),
				secure: useSecureCookies({ dev, origin }),
			});
			try {
				response.headers.append('set-cookie', cookie);
				return response;
			} catch {
				// Immutable headers (e.g. a proxied response): copy.
				const headers = new Headers(response.headers);
				headers.append('set-cookie', cookie);
				return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
			}
		},
	};
}
