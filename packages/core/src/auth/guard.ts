// Pure admin-guard decisions (no Better Auth, no SvelteKit, no env), so they are unit-testable.
// Security-critical: the admin guard and the CSRF origin check live here.

/** The admin views the guard cares about (a subset of `AdminRoute['view']`). */
export type GuardView = 'login' | 'create-first-user' | 'forgot-password' | 'reset-password' | (string & {});

export type GuardDecision =
	| { kind: 'allow' }
	| { kind: 'redirect'; to: 'login' | 'create-first-user' | 'dashboard' }
	/** Signed in, but not allowed into the admin (`access.admin` / role): never let them in. */
	| { kind: 'deny' };

/**
 * Decides what to do with an admin request.
 * `user` is the resolved session user (null when signed out). `canUseAdmin` is the auth collection's
 * `adminAccess(config, req)` result for that user (false when signed out). `userCount` is the total
 * number of users; a signed-in user implies at least one, so callers may pass `1` without querying.
 */
export function decideAdminAccess(input: {
	view: GuardView;
	user: object | null;
	canUseAdmin: boolean;
	userCount: number;
}): GuardDecision {
	const { view, user, userCount } = input;
	// Fail closed: a signed-out request can never be allowed, whatever the caller passed.
	const allowed = user !== null && input.canUseAdmin === true;

	if (view === 'login') {
		if (allowed) return { kind: 'redirect', to: 'dashboard' };
		return userCount === 0 ? { kind: 'redirect', to: 'create-first-user' } : { kind: 'allow' };
	}
	// Password links (Decision 37) work signed out and signed in (an invite opened in a browser where
	// someone else is signed in). They change nothing until a valid token is posted.
	if (view === 'forgot-password' || view === 'reset-password') {
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
