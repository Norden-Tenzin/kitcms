// Pure path helpers (no SvelteKit imports), unit-testable.

/**
 * The request path relative to `paths.base`, decoded. `null` when the request is outside the base
 * (kitcms must not handle it). `base` is `''` or starts with `/` and has no trailing slash.
 */
export function stripBase(pathname: string, base: string): string | null {
	let p: string;
	try {
		p = decodeURI(pathname);
	} catch {
		p = pathname;
	}
	if (!base) return p;
	if (p === base) return '/';
	if (p.startsWith(`${base}/`)) return p.slice(base.length);
	return null;
}

/** Base-relative paths that need a resolved session: the admin and the API. */
export function needsSession(pathname: string): boolean {
	return (
		pathname === '/admin' ||
		pathname.startsWith('/admin/') ||
		pathname === '/api' ||
		pathname.startsWith('/api/')
	);
}

/** Better Auth's own endpoints (base-relative). */
export function isAuthPath(pathname: string): boolean {
	return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}
