// Response helpers: JSON vs. no-JS redirect, and the open-redirect guard.

/**
 * Returns a same-origin RELATIVE path (`/a/b?x=1`) or `null`. Only accepts a `/`-prefixed value
 * that is not protocol-relative (`//host`), has no backslash or control characters, and resolves
 * to the same origin.
 */
export function safeLocalPath(candidate: unknown, origin: string): string | null {
	if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 2000) return null;
	if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
	// eslint-disable-next-line no-control-regex
	if (candidate.includes('\\') || /[\u0000-\u001f\u007f]/.test(candidate)) return null;
	try {
		const u = new URL(candidate, origin);
		if (u.origin !== origin) return null;
		return u.pathname + u.search;
	} catch {
		return null;
	}
}

/** The page the visitor submitted from: `_page` (relative path) or the same-origin Referer; else `null`. */
export function pageTarget(page: unknown, referer: string | null, origin: string): string | null {
	const fromPage = safeLocalPath(page, origin);
	if (fromPage) return fromPage;
	if (referer) {
		try {
			const r = new URL(referer);
			if (r.origin === origin) return safeLocalPath(r.pathname + r.search, origin);
		} catch {
			/* ignore */
		}
	}
	return null;
}

/** 303 to `target` (already safe) with `enquiry=...` set; replaces any earlier `enquiry*` params. */
export function redirectWith(target: string, params: Record<string, string>): Response {
	const u = new URL(target, 'http://local.invalid');
	for (const k of ['enquiry', 'fields', 'error']) u.searchParams.delete(k);
	for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
	return new Response(null, {
		status: 303,
		headers: { location: u.pathname + u.search, 'cache-control': 'no-store' },
	});
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): Response {
	return Response.json({ error, ...extra }, { status, headers: { 'cache-control': 'no-store' } });
}
