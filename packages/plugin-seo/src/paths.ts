// Pure helpers shared by redirects, sitemap and robots. No runtime dependencies.

/** Strip trailing slashes (keeps `/`) and surrounding whitespace. `'/about/'` -> `'/about'`. */
export function normalizePath(path: string): string {
	const p = path.trim().replace(/\/+$/, '');
	return p === '' ? '/' : p;
}

const hasBadChars = (s: string): boolean => {
	if (/[\s\\]/.test(s)) return true;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		if (c < 32 || c === 127) return true;
	}
	return false;
};

/** Is `path` under `/admin` or `/api` (never reaches the plugin handle)? */
export const isReservedPath = (path: string): boolean =>
	/^\/(admin|api)(\/|$)/.test(path);

/** `true` when valid, else an error message. Expects an already normalized value. */
export function checkFrom(from: string): true | string {
	if (from.length > 500) return 'Must be at most 500 characters.';
	if (!from.startsWith('/') || from.startsWith('//')) return 'Must be a path starting with a single "/", e.g. /old-page.';
	if (from.includes('?') || from.includes('#')) return 'Path only: leave out the query string and #fragment.';
	if (hasBadChars(from)) return 'Must not contain spaces or backslashes.';
	if (isReservedPath(from)) return 'Paths under /admin and /api cannot be redirected.';
	return true;
}

/** `true` when valid, else an error message. Only `/`-relative paths and http(s) URLs are allowed. */
export function checkTo(to: string): true | string {
	if (to.length > 2000) return 'Must be at most 2000 characters.';
	if (hasBadChars(to)) return 'Must not contain spaces or backslashes.';
	if (to.startsWith('//')) return 'Protocol-relative URLs are not allowed. Use a /path or a full https:// URL.';
	if (to.startsWith('/')) return true;
	if (/^https?:\/\//i.test(to)) {
		try {
			return new URL(to).hostname ? true : 'Invalid URL.';
		} catch {
			return 'Invalid URL.';
		}
	}
	return 'Must be a /path or a full http(s):// URL.';
}

/** The path part of a redirect target, normalized, or `null` for external URLs. */
export function targetPath(to: string): string | null {
	if (!to.startsWith('/')) return null;
	const end = to.search(/[?#]/);
	return normalizePath(end === -1 ? to : to.slice(0, end));
}

/**
 * Follow `map` from `to`. Returns `true` when the chain comes back to `from` within `maxHops`
 * (including `to === from`), i.e. adding `from -> to` would create a loop.
 */
export function createsLoop(map: ReadonlyMap<string, string>, from: string, to: string, maxHops = 10): boolean {
	let current = targetPath(to);
	for (let i = 0; i < maxHops && current !== null; i++) {
		if (current === from) return true;
		const next = map.get(current);
		current = next === undefined ? null : targetPath(next);
	}
	return false;
}

/** Escape text for XML element content. */
export function xmlEscape(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export type PathBuilder = string | ((doc: Record<string, unknown>) => string | null);

/**
 * Build a doc's path. A string pattern substitutes `:field` with the (URL-encoded) field value;
 * a missing or empty value skips the doc (`null`). The result must start with `/`.
 */
export function buildDocPath(builder: PathBuilder, doc: Record<string, unknown>): string | null {
	let out: string | null;
	if (typeof builder === 'function') {
		out = builder(doc);
	} else {
		let missing = false;
		out = builder.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => {
			const v = doc[name];
			if ((typeof v !== 'string' && typeof v !== 'number') || String(v) === '') {
				missing = true;
				return '';
			}
			return encodeURIComponent(String(v));
		});
		if (missing) out = null;
	}
	return typeof out === 'string' && out.startsWith('/') && !out.startsWith('//') ? out : null;
}

/**
 * The app's `paths.base` (`''` or `/prefix`), from the full pathname and the base-relative,
 * decoded `path` the plugin handle receives.
 */
export function baseFrom(pathname: string, path: string): string {
	let decoded = pathname;
	try {
		decoded = decodeURI(pathname);
	} catch {
		/* keep the raw pathname */
	}
	const p = decoded.replace(/\/+$/, '');
	const q = path.replace(/\/+$/, '');
	return p.endsWith(q) ? p.slice(0, p.length - q.length) : '';
}
