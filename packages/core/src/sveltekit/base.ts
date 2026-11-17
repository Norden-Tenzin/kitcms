// `paths.base` on the server. Kit 3 has no public `base` export, and `resolve('/')` returns a path
// RELATIVE to the current request during SSR (`paths.relative`). Resolving it against the request
// URL gives the absolute base. The base is constant per build, so the first value seen in a
// request is cached. Outside a request (RPC, tests) before any request: `''`.
import { resolve } from '$app/paths';
import { getRequestEvent } from '$app/server';

let cached: string | undefined;

/** `''` or `/base` (no trailing slash). */
export function basePath(url?: URL): string {
	if (cached !== undefined) return cached;
	let requestUrl = url;
	if (!requestUrl) {
		try {
			requestUrl = getRequestEvent().url;
		} catch {
			return ''; // not inside a request
		}
	}
	try {
		const root = (resolve as (id: string) => string)('/');
		cached = new URL(root, requestUrl).pathname.replace(/\/$/, '');
		return cached;
	} catch {
		return '';
	}
}
