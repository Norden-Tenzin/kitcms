// The lazy auth module: `kitcms.handle` imports it only for base-relative /admin* and /api* paths
// (Decision 18), so public routes never evaluate Better Auth.
import { building } from '$app/env';
import type { RequestEvent } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { KitcmsInternals, KitcmsSession, KitcmsUser } from '../sveltekit/index';
import { getAuth } from './better-auth';
import { toAuthSession, toKitcmsUser } from './session';

import { basePath } from '../sveltekit/base';
import { stripBase } from '../sveltekit/paths';

export { isAuthPath } from '../sveltekit/paths';

/**
 * Better Auth endpoints reachable over HTTP. An ALLOWLIST (not Better Auth's `disabledPaths`
 * denylist), so endpoints added by future Better Auth versions stay closed. Everything that
 * writes user/account data (update-user, change-email, change-password, delete-user, reset flows,
 * social linking, ...) must go through the kitcms pipeline and admin actions instead (one
 * pipeline, CLAUDE.md hard rule). `sign-in/email` keeps Better Auth's D1 rate limit.
 */
export const PUBLIC_AUTH_PATHS: ReadonlySet<string> = new Set([
	'/sign-in/email',
	'/sign-out',
	'/get-session',
	'/list-sessions',
	'/revoke-session',
	'/revoke-sessions',
	'/revoke-other-sessions',
	'/ok',
	'/error',
]);

/** Serves the allowed `<base>/api/auth/*` endpoints with Better Auth; everything else is a 404. */
export async function handleAuthRoute(
	event: RequestEvent,
	resolve: (event: RequestEvent) => Response | Promise<Response>,
	k: KitcmsInternals,
): Promise<Response> {
	const path = stripBase(event.url.pathname, basePath(event.url));
	const sub = path?.slice('/api/auth'.length).replace(/\/+$/, '') ?? '';
	if (!PUBLIC_AUTH_PATHS.has(sub)) {
		return Response.json({ error: 'Not found.' }, { status: 404 });
	}
	const auth = getAuth(k, event.url);
	return svelteKitHandler({ auth, event, resolve, building });
}

/** The session behind the request's cookie, or `null`. One D1 read (none within a cookie-cache window). */
export async function resolveSession(
	event: RequestEvent,
	k: KitcmsInternals,
): Promise<{ user: KitcmsUser; session: KitcmsSession } | null> {
	const auth = getAuth(k, event.url);
	const result = await auth.api.getSession({ headers: event.request.headers });
	if (!result) return null;
	return {
		user: toKitcmsUser(result.user as Record<string, unknown>, k.config.authCollection),
		session: toAuthSession(result.session as Record<string, unknown>),
	};
}
