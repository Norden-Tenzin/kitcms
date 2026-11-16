import { describe, expect, it } from 'vitest';
import { decideAdminAccess, isRole, isSameOrigin, needsSession } from './auth-guard';

const admin = { role: 'admin' };
const editor = { role: 'editor' };

describe('decideAdminAccess', () => {
	it('signed out -> login when users exist', () => {
		for (const view of ['dashboard', 'list', 'edit']) {
			expect(decideAdminAccess({ view, user: null, userCount: 3 })).toEqual({
				kind: 'redirect',
				to: 'login',
			});
		}
	});

	it('signed out and no users -> create-first-user', () => {
		for (const view of ['dashboard', 'list', 'edit', 'login']) {
			expect(decideAdminAccess({ view, user: null, userCount: 0 })).toEqual({
				kind: 'redirect',
				to: 'create-first-user',
			});
		}
	});

	it('admin and editor are allowed on protected views', () => {
		expect(decideAdminAccess({ view: 'edit', user: admin, userCount: 1 })).toEqual({ kind: 'allow' });
		expect(decideAdminAccess({ view: 'list', user: editor, userCount: 1 })).toEqual({ kind: 'allow' });
	});

	it('unknown, missing or non-string role is denied', () => {
		for (const role of ['superuser', '', 'ADMIN', undefined, null, 1, { x: 1 }]) {
			expect(decideAdminAccess({ view: 'dashboard', user: { role }, userCount: 1 })).toEqual({
				kind: 'deny',
			});
		}
	});

	it('login view: allowed when signed out, bounces a valid user to the dashboard', () => {
		expect(decideAdminAccess({ view: 'login', user: null, userCount: 2 })).toEqual({ kind: 'allow' });
		expect(decideAdminAccess({ view: 'login', user: admin, userCount: 2 })).toEqual({
			kind: 'redirect',
			to: 'dashboard',
		});
		// a user with an unknown role can still reach the login page (to sign out / switch account)
		expect(decideAdminAccess({ view: 'login', user: { role: 'x' }, userCount: 2 })).toEqual({
			kind: 'allow',
		});
	});

	it('create-first-user view: only when zero users exist', () => {
		expect(decideAdminAccess({ view: 'create-first-user', user: null, userCount: 0 })).toEqual({
			kind: 'allow',
		});
		expect(decideAdminAccess({ view: 'create-first-user', user: null, userCount: 1 })).toEqual({
			kind: 'redirect',
			to: 'login',
		});
		expect(decideAdminAccess({ view: 'create-first-user', user: admin, userCount: 1 })).toEqual({
			kind: 'redirect',
			to: 'dashboard',
		});
	});
});

describe('isRole', () => {
	it('accepts only the known roles', () => {
		expect(isRole('admin')).toBe(true);
		expect(isRole('editor')).toBe(true);
		expect(isRole('Admin')).toBe(false);
		expect(isRole(undefined)).toBe(false);
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

describe('needsSession', () => {
	it('only /admin and /api paths', () => {
		for (const p of ['/admin', '/admin/', '/admin/collections/pages', '/api', '/api/pages', '/api/auth/get-session']) {
			expect(needsSession(p)).toBe(true);
		}
		for (const p of ['/', '/about', '/administrator', '/apix', '/blog/admin', '/spike']) {
			expect(needsSession(p)).toBe(false);
		}
	});
});
