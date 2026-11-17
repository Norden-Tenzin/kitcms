// Pure helpers for the auth module (no Better Auth, no SvelteKit, no env), so they are unit-testable.

/** Hostnames that mean "this machine": the only places a non-dev build may serve cookies over http. */
export function isLoopbackHost(hostname: string): boolean {
	const h = hostname.toLowerCase();
	return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
}

/**
 * Whether session cookies get the `Secure` flag. Fail closed: `Secure` unless the origin we serve
 * is plain `http:` AND we're on a dev server or a loopback host. A deployed Worker is reached on
 * a public https hostname, so it can never end up with insecure cookies (and a configured https
 * `BETTER_AUTH_URL` forces `Secure` regardless of the request).
 *
 * `origin` is `BETTER_AUTH_URL` when set, else the request URL. `null` (unknown) is secure.
 */
export function useSecureCookies(input: { dev: boolean; origin: URL | null }): boolean {
	const { dev, origin } = input;
	if (origin === null) return true;
	if (origin.protocol !== 'http:') return true;
	return !(dev || isLoopbackHost(origin.hostname));
}

/** `BETTER_AUTH_URL` reduced to its origin (a path would confuse `basePath`). `undefined` when unset or invalid. */
export function parseBaseOrigin(value: unknown): URL | undefined {
	if (typeof value !== 'string' || !value.trim()) return undefined;
	try {
		return new URL(new URL(value.trim()).origin);
	} catch {
		return undefined;
	}
}

/** Better Auth's `basePath` for an app served under `paths.base`. `base` is `''` or `/x` (no trailing slash). */
export function authBasePath(base: string): string {
	return `${base.replace(/\/+$/, '')}/api/auth`;
}
