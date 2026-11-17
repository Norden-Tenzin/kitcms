import { describe, expect, it, vi } from 'vitest';
import { defineConfig, collection } from '../config/collection';
import { sanitizeConfig } from '../config/sanitize';
import { dbFor } from '../runtime';
import {
	BOOKMARK_COOKIE,
	isValidBookmark,
	readBookmarkCookie,
	serializeBookmarkCookie,
	sessionStartFor,
} from './session';

const BM = '00000085-0000024c-00004e2f-a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('session start', () => {
	it('anonymous → first-unconstrained, even with a cookie', () => {
		expect(sessionStartFor({ signedIn: false, bookmark: BM })).toBe('first-unconstrained');
	});
	it('signed in without a bookmark → first-primary', () => {
		expect(sessionStartFor({ signedIn: true, bookmark: null })).toBe('first-primary');
	});
	it('signed in with a bookmark → that bookmark', () => {
		expect(sessionStartFor({ signedIn: true, bookmark: BM })).toBe(BM);
	});
});

describe('bookmark cookie', () => {
	it('reads a valid bookmark among other cookies', () => {
		expect(readBookmarkCookie(`a=1; ${BOOKMARK_COOKIE}=${BM}; b=2`)).toBe(BM);
	});
	it('ignores invalid values', () => {
		for (const v of ['', 'a b', '<script>', 'a'.repeat(201), 'first-primary"']) {
			expect(readBookmarkCookie(`${BOOKMARK_COOKIE}=${v}`)).toBeNull();
		}
		expect(readBookmarkCookie(null)).toBeNull();
		expect(readBookmarkCookie('other=1')).toBeNull();
		expect(isValidBookmark(BM)).toBe(true);
	});
	it('serializes with HttpOnly, SameSite=Lax, base path and Secure', () => {
		expect(serializeBookmarkCookie(BM, { base: '', secure: true })).toBe(
			`${BOOKMARK_COOKIE}=${BM}; Path=/; HttpOnly; SameSite=Lax; Secure`,
		);
		expect(serializeBookmarkCookie(BM, { base: '/cms', secure: false })).toBe(
			`${BOOKMARK_COOKIE}=${BM}; Path=/cms/; HttpOnly; SameSite=Lax`,
		);
	});
});

describe('dbFor opens a session per request', () => {
	const config = sanitizeConfig(defineConfig({ collections: [collection({ slug: 'pages', fields: {} })] }));
	function fakeBinding() {
		const starts: unknown[] = [];
		const binding = {
			withSession: vi.fn((s: unknown) => {
				starts.push(s);
				return { prepare: vi.fn(), batch: vi.fn(), getBookmark: () => BM };
			}),
			prepare: vi.fn(),
			batch: vi.fn(),
		};
		return { binding, starts };
	}
	it('defaults to first-unconstrained, passes constraints and bookmarks through, new session each call', () => {
		const { binding, starts } = fakeBinding();
		const env = { [config.bindings.db]: binding };
		const a = dbFor(config, env);
		dbFor(config, env, 'first-primary');
		dbFor(config, env, BM);
		expect(starts).toEqual(['first-unconstrained', 'first-primary', BM]);
		expect(a.bookmark?.()).toBe(BM);
	});
	it('falls back to the raw binding without withSession', () => {
		const env = { [config.bindings.db]: { prepare: vi.fn(), batch: vi.fn() } };
		expect(dbFor(config, env).bookmark?.()).toBeNull();
	});
});
