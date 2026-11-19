// Config values resolved per request (Decision 36). One build of an app can serve many deployments
// (one Worker per site, each with its own D1 and Worker vars), so a few settings that differ per
// deployment may be functions of the Worker's env and the site's own content instead of constants:
// the email sender, the admin title, a plugin's notify addresses or a Turnstile site key.
//
//   email: { from: ({ env }) => ({ address: String(env.EMAIL_FROM), name: 'Website' }) }
//   admin: { title: async ({ cms }) => (await cms.findGlobal('site')).siteName }
//
// Runtime-agnostic: no Workers or Node APIs.
import type { Cms } from '../api/types';

/** What a resolvable value is computed from. */
export interface RuntimeContext {
	/** The Worker's env: vars and secrets (`import { env } from 'cloudflare:workers'`). */
	env: Record<string, unknown>;
	/**
	 * The Local API acting as the SYSTEM (`overrideAccess`, drafts excluded unless asked for), so a
	 * value can come from the site's content whoever the request is from. Read with it; don't write.
	 */
	cms: Cms;
}

/** A constant, or a function of the request's runtime context. */
export type Resolvable<T> = T | ((ctx: RuntimeContext) => T | Promise<T>);

/** Resolves a `Resolvable`. Functions are called on every call: cache inside them if needed. */
export async function resolveValue<T>(value: Resolvable<T>, ctx: RuntimeContext): Promise<T> {
	return typeof value === 'function' ? await (value as (ctx: RuntimeContext) => T | Promise<T>)(ctx) : value;
}
