import { describe, expect, it } from 'vitest';
import { authBasePath, isLoopbackHost, parseBaseOrigin, useSecureCookies } from './cookies';

const u = (s: string) => new URL(s);

describe('useSecureCookies', () => {
	it('is secure on any https origin, in dev or not', () => {
		expect(useSecureCookies({ dev: false, origin: u('https://cms.example.com/admin') })).toBe(true);
		expect(useSecureCookies({ dev: true, origin: u('https://localhost:5173') })).toBe(true);
	});

	it('is insecure only for http on loopback (wrangler dev) or in dev', () => {
		expect(useSecureCookies({ dev: false, origin: u('http://localhost:8787') })).toBe(false);
		expect(useSecureCookies({ dev: false, origin: u('http://127.0.0.1:8787') })).toBe(false);
		expect(useSecureCookies({ dev: false, origin: u('http://[::1]:8787') })).toBe(false);
		expect(useSecureCookies({ dev: true, origin: u('http://192.168.1.5:5173') })).toBe(false);
	});

	it('a deployed (non-dev) Worker on a public host is secure even over http, and when unknown', () => {
		expect(useSecureCookies({ dev: false, origin: u('http://cms.example.com') })).toBe(true);
		expect(useSecureCookies({ dev: false, origin: u('http://localhost.evil.com') })).toBe(true);
		expect(useSecureCookies({ dev: false, origin: null })).toBe(true);
		expect(useSecureCookies({ dev: true, origin: null })).toBe(true);
	});
});

describe('isLoopbackHost', () => {
	it('matches only loopback names', () => {
		for (const h of ['localhost', 'LOCALHOST', '127.0.0.1', '[::1]']) expect(isLoopbackHost(h)).toBe(true);
		for (const h of ['localhost.evil.com', '127.0.0.2', 'example.com', '']) expect(isLoopbackHost(h)).toBe(false);
	});
});

describe('parseBaseOrigin', () => {
	it('reduces to the origin and ignores junk', () => {
		expect(parseBaseOrigin('https://cms.example.com/some/path')?.href).toBe('https://cms.example.com/');
		expect(parseBaseOrigin(' http://localhost:5173 ')?.origin).toBe('http://localhost:5173');
		for (const v of [undefined, '', '  ', 'not a url', 42]) expect(parseBaseOrigin(v)).toBeUndefined();
	});
});

describe('authBasePath', () => {
	it('respects paths.base', () => {
		expect(authBasePath('')).toBe('/api/auth');
		expect(authBasePath('/cms')).toBe('/cms/api/auth');
		expect(authBasePath('/cms/')).toBe('/cms/api/auth');
	});
});
