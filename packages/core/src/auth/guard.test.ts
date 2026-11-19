import { describe, expect, it } from 'vitest';
import { decideAdminAccess, isSameOrigin } from './guard';

const user = { id: 'u1' };

describe('decideAdminAccess', () => {
	it('signed out -> login when users exist', () => {
		for (const view of ['dashboard', 'list', 'edit']) {
			expect(decideAdminAccess({ view, user: null, canUseAdmin: false, userCount: 3 })).toEqual({
				kind: 'redirect',
				to: 'login',
			});
		}
	});

	it('signed out and no users -> create-first-user', () => {
		for (const view of ['dashboard', 'list', 'edit', 'login']) {
			expect(decideAdminAccess({ view, user: null, canUseAdmin: false, userCount: 0 })).toEqual({
				kind: 'redirect',
				to: 'create-first-user',
			});
		}
	});

	it('a user who can use the admin is allowed on protected views', () => {
		expect(decideAdminAccess({ view: 'edit', user, canUseAdmin: true, userCount: 1 })).toEqual({ kind: 'allow' });
		expect(decideAdminAccess({ view: 'list', user, canUseAdmin: true, userCount: 1 })).toEqual({ kind: 'allow' });
	});

	it('a signed-in user who cannot use the admin is denied', () => {
		for (const view of ['dashboard', 'list', 'edit']) {
			expect(decideAdminAccess({ view, user, canUseAdmin: false, userCount: 1 })).toEqual({ kind: 'deny' });
		}
	});

	it('fails closed: canUseAdmin without a user never allows', () => {
		expect(decideAdminAccess({ view: 'dashboard', user: null, canUseAdmin: true, userCount: 1 })).toEqual({
			kind: 'redirect',
			to: 'login',
		});
	});

	it('login view: allowed when signed out, bounces an admin user to the dashboard', () => {
		expect(decideAdminAccess({ view: 'login', user: null, canUseAdmin: false, userCount: 2 })).toEqual({
			kind: 'allow',
		});
		expect(decideAdminAccess({ view: 'login', user, canUseAdmin: true, userCount: 2 })).toEqual({
			kind: 'redirect',
			to: 'dashboard',
		});
		// a user without admin access can still reach the login page (to sign out / switch account)
		expect(decideAdminAccess({ view: 'login', user, canUseAdmin: false, userCount: 2 })).toEqual({
			kind: 'allow',
		});
	});

	it('create-first-user view: only when zero users exist', () => {
		expect(decideAdminAccess({ view: 'create-first-user', user: null, canUseAdmin: false, userCount: 0 })).toEqual({
			kind: 'allow',
		});
		expect(decideAdminAccess({ view: 'create-first-user', user: null, canUseAdmin: false, userCount: 1 })).toEqual({
			kind: 'redirect',
			to: 'login',
		});
		expect(decideAdminAccess({ view: 'create-first-user', user, canUseAdmin: true, userCount: 1 })).toEqual({
			kind: 'redirect',
			to: 'dashboard',
		});
	});
});

describe('isSameOrigin', () => {
	const url = new URL('https://cms.example.com/admin/collections/pages/1?/save');
	const req = (origin?: string) =>
		new Request(url, { method: 'POST', headers: origin === undefined ? {} : { origin } });

	it('accepts the app origin', () => {
		expect(isSameOrigin(req('https://cms.example.com'), url)).toBe(true);
	});

	it('rejects other origins, scheme/port/subdomain differences, null and missing', () => {
		expect(isSameOrigin(req('https://evil.example.org'), url)).toBe(false);
		expect(isSameOrigin(req('http://cms.example.com'), url)).toBe(false);
		expect(isSameOrigin(req('https://cms.example.com:8443'), url)).toBe(false);
		expect(isSameOrigin(req('https://sub.cms.example.com'), url)).toBe(false);
		expect(isSameOrigin(req('https://cms.example.com.evil.org'), url)).toBe(false);
		expect(isSameOrigin(req('null'), url)).toBe(false);
		expect(isSameOrigin(req(), url)).toBe(false);
		expect(isSameOrigin(req(''), url)).toBe(false);
	});
});

describe('password link views (Decision 42)', () => {
	for (const view of ['forgot-password', 'reset-password'] as const) {
		it(`${view}: open signed out and signed in, but not before the first user`, () => {
			expect(decideAdminAccess({ view, user: null, canUseAdmin: false, userCount: 3 })).toEqual({ kind: 'allow' });
			expect(decideAdminAccess({ view, user: {}, canUseAdmin: true, userCount: 3 })).toEqual({ kind: 'allow' });
			expect(decideAdminAccess({ view, user: {}, canUseAdmin: false, userCount: 3 })).toEqual({ kind: 'allow' });
			expect(decideAdminAccess({ view, user: null, canUseAdmin: false, userCount: 0 })).toEqual({
				kind: 'redirect',
				to: 'create-first-user',
			});
		});
	}
	it('other views are unaffected', () => {
		expect(decideAdminAccess({ view: 'dashboard', user: null, canUseAdmin: false, userCount: 3 })).toEqual({
			kind: 'redirect',
			to: 'login',
		});
	});
});
