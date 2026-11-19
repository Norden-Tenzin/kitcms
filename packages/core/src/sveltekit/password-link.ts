// Absolute links to the admin's reset-password page (Decision 42).
import { resolve } from '$app/paths';
import { parseBaseOrigin } from '../auth/cookies';
import type { KitcmsInternals } from './index';

const ADMIN = '/(kitcms)/admin/[...path]';

/**
 * Builds password links (Decision 42) on the configured origin (`BETTER_AUTH_URL`) or, without one,
 * the request's own: a Worker is only reachable on its own hostnames.
 */
export function passwordLink(k: KitcmsInternals, url: URL): (token: string) => string {
	const origin = parseBaseOrigin(k.env.BETTER_AUTH_URL)?.origin ?? url.origin;
	return (token) => new URL(`${(resolve as (id: string, p: object) => string)(ADMIN, { path: 'reset-password' })}?token=${encodeURIComponent(token)}`, origin).href;
}
