// D1 read replication helpers (plan §13.10). Pure: no bindings, no SvelteKit, unit-testable.

/** The cookie holding a signed-in user's last D1 bookmark (sequential consistency across requests). */
export const BOOKMARK_COOKIE = 'kitcms-d1';

/** What `D1Database.withSession` takes: a constraint or an opaque bookmark. */
export type SessionStart = D1SessionConstraint | D1SessionBookmark;

/** D1 bookmarks are opaque (today hex groups joined by dashes); accept only a conservative charset. */
const BOOKMARK_RE = /^[A-Za-z0-9_-]{1,200}$/;

export function isValidBookmark(value: unknown): value is string {
	return typeof value === 'string' && BOOKMARK_RE.test(value);
}

/** Reads the bookmark from a `Cookie` header; `null` when absent or malformed. */
export function readBookmarkCookie(cookieHeader: string | null | undefined): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(';')) {
		const eq = part.indexOf('=');
		if (eq < 0) continue;
		if (part.slice(0, eq).trim() !== BOOKMARK_COOKIE) continue;
		const value = part.slice(eq + 1).trim();
		return isValidBookmark(value) ? value : null;
	}
	return null;
}

/** `Set-Cookie` value for the bookmark. `path` is `<base>/` (`/` without a base). */
export function serializeBookmarkCookie(bookmark: string, opts: { base: string; secure: boolean }): string {
	const path = `${opts.base.replace(/\/+$/, '')}/`;
	return `${BOOKMARK_COOKIE}=${bookmark}; Path=${path}; HttpOnly; SameSite=Lax${opts.secure ? '; Secure' : ''}`;
}

/** Where a request's D1 session starts: anonymous → nearest replica; signed in → their bookmark, else primary. */
export function sessionStartFor(input: { signedIn: boolean; bookmark: string | null }): SessionStart {
	if (!input.signedIn) return 'first-unconstrained';
	return input.bookmark ?? 'first-primary';
}
