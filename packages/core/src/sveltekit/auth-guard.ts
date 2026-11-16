// Pure auth decisions (no Better Auth, no SvelteKit, no env), so they are unit-testable.
// Security-critical: the admin guard and the CSRF origin check live here.

export const ROLES = ['admin', 'editor'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
	return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** The admin views the guard cares about (a subset of `AdminRoute['view']`). */
export type GuardView = 'login' | 'create-first-user' | (string & {});

export type GuardDecision =
	| { kind: 'allow' }
	| { kind: 'redirect'; to: 'login' | 'create-first-user' | 'dashboard' }
	/** Signed in, but with a role kitcms doesn't know: never let them into the admin. */
	| { kind: 'deny' };

/**
 * Decides what to do with an admin request.
 * `user` is the resolved session user (null when signed out). `userCount` is the total number of users;
 * a signed-in user implies at least one, so callers may pass `1` without querying.
 */
export function decideAdminAccess(input: {
	view: GuardView;
	user: { role: unknown } | null;
	userCount: number;
}): GuardDecision {
	const { view, user, userCount } = input;
	const allowed = user !== null && isRole(user.role);

	if (view === 'login') {
		if (allowed) return { kind: 'redirect', to: 'dashboard' };
		return userCount === 0 ? { kind: 'redirect', to: 'create-first-user' } : { kind: 'allow' };
	}
	if (view === 'create-first-user') {
		if (userCount > 0) return { kind: 'redirect', to: allowed ? 'dashboard' : 'login' };
		return { kind: 'allow' };
	}
	if (allowed) return { kind: 'allow' };
	if (user !== null) return { kind: 'deny' };
	return { kind: 'redirect', to: userCount === 0 ? 'create-first-user' : 'login' };
}

/**
 * CSRF defence for state-changing admin requests: the `Origin` header must be present and equal
 * the app's own origin. A missing or `null` origin is rejected. (SvelteKit's own check is off in dev
 * and only covers form content types, so kitcms does its own.)
 */
export function isSameOrigin(request: Request, url: URL): boolean {
	const origin = request.headers.get('origin');
	if (!origin) return false;
	return origin === url.origin;
}

/** Paths that need a resolved session: the admin and the API. Public pages must never hit the session table. */
export function needsSession(pathname: string): boolean {
	return (
		pathname === '/admin' ||
		pathname.startsWith('/admin/') ||
		pathname === '/api' ||
		pathname.startsWith('/api/')
	);
}
