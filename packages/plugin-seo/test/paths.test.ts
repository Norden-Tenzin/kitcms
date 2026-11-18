import { describe, expect, it } from 'vitest';
import {
	baseFrom,
	buildDocPath,
	checkFrom,
	checkTo,
	createsLoop,
	normalizePath,
	targetPath,
	xmlEscape,
} from '../src/paths';
import { locationFor } from '../src/redirects';
import { renderRobots, renderSitemap } from '../src/sitemap';

describe('normalizePath', () => {
	it('strips trailing slashes but keeps the root', () => {
		expect(normalizePath('/about/')).toBe('/about');
		expect(normalizePath('/a/b//')).toBe('/a/b');
		expect(normalizePath('/')).toBe('/');
		expect(normalizePath('')).toBe('/');
		expect(normalizePath('  /x  ')).toBe('/x');
	});
});

describe('checkFrom / checkTo', () => {
	it('validates the source path', () => {
		expect(checkFrom('/old')).toBe(true);
		expect(checkFrom('old')).not.toBe(true);
		expect(checkFrom('//old')).not.toBe(true);
		expect(checkFrom('/old?x=1')).not.toBe(true);
		expect(checkFrom('/old#x')).not.toBe(true);
		expect(checkFrom('/admin')).not.toBe(true);
		expect(checkFrom('/admin/x')).not.toBe(true);
		expect(checkFrom('/api/x')).not.toBe(true);
		expect(checkFrom('/administrator')).toBe(true);
		expect(checkFrom('/' + 'a'.repeat(500))).not.toBe(true);
	});
	it('validates the target', () => {
		expect(checkTo('/new?x=1#y')).toBe(true);
		expect(checkTo('https://example.com/a')).toBe(true);
		expect(checkTo('http://example.com')).toBe(true);
		expect(checkTo('javascript:alert(1)')).not.toBe(true);
		expect(checkTo('data:text/html,x')).not.toBe(true);
		expect(checkTo('//evil.test')).not.toBe(true);
		expect(checkTo('/\\evil.test')).not.toBe(true);
		expect(checkTo('about')).not.toBe(true);
		expect(checkTo('https://')).not.toBe(true);
	});
	it('targetPath', () => {
		expect(targetPath('/a/?x=1')).toBe('/a');
		expect(targetPath('https://x.test/a')).toBeNull();
	});
});

describe('createsLoop', () => {
	it('detects self, direct and long loops', () => {
		const map = new Map([
			['/b', '/c'],
			['/c', '/a'],
		]);
		expect(createsLoop(map, '/a', '/a')).toBe(true);
		expect(createsLoop(map, '/a', '/b')).toBe(true);
		expect(createsLoop(map, '/a', '/z')).toBe(false);
		expect(createsLoop(map, '/a', 'https://x.test/a')).toBe(false);
		expect(createsLoop(map, '/a', '/b?x=1')).toBe(true);
	});
	it('stops after maxHops on an unrelated cycle', () => {
		const map = new Map([
			['/x', '/y'],
			['/y', '/x'],
		]);
		expect(createsLoop(map, '/a', '/x')).toBe(false);
	});
});

describe('buildDocPath', () => {
	it('substitutes and encodes :fields', () => {
		expect(buildDocPath('/rooms/:slug', { slug: 'big room' })).toBe('/rooms/big%20room');
		expect(buildDocPath('/rooms/:slug', { slug: '' })).toBeNull();
		expect(buildDocPath('/rooms/:slug', {})).toBeNull();
		expect(buildDocPath('/r/:id/x/:slug', { id: 3, slug: 'a/b' })).toBe('/r/3/x/a%2Fb');
	});
	it('functions can skip and must return a path', () => {
		expect(buildDocPath(() => null, {})).toBeNull();
		expect(buildDocPath((d) => (d.slug === 'home' ? '/' : `/${d.slug}`), { slug: 'home' })).toBe('/');
		expect(buildDocPath(() => 'nope', {})).toBeNull();
		expect(buildDocPath(() => '//evil.test', {})).toBeNull();
	});
});

describe('xmlEscape, baseFrom, rendering', () => {
	it('escapes XML', () => {
		expect(xmlEscape(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
		expect(renderSitemap([{ loc: 'https://x.test/?a=1&b=2' }])).toContain('<loc>https://x.test/?a=1&amp;b=2</loc>');
	});
	it('baseFrom', () => {
		expect(baseFrom('/about', '/about')).toBe('');
		expect(baseFrom('/', '/')).toBe('');
		expect(baseFrom('/site/about', '/about')).toBe('/site');
		expect(baseFrom('/site', '/')).toBe('/site');
		expect(baseFrom('/site/', '/')).toBe('/site');
		expect(baseFrom('/s/caf%C3%A9', '/café')).toBe('/s');
	});
	it('robots', () => {
		expect(renderRobots({}, null)).toBe('User-agent: *\nDisallow: /admin\nDisallow: /api\n');
		expect(renderRobots({ disallow: ['/private'] }, 'https://x.test/sitemap.xml')).toBe(
			'User-agent: *\nDisallow: /admin\nDisallow: /api\nDisallow: /private\n\nSitemap: https://x.test/sitemap.xml\n',
		);
	});
	it('locationFor keeps the query unless the target has one', () => {
		const url = new URL('https://x.test/old?utm=1');
		expect(locationFor({ to: '/new', status: 301 }, url, '')).toBe('/new?utm=1');
		expect(locationFor({ to: '/new?a=2', status: 301 }, url, '')).toBe('/new?a=2');
		expect(locationFor({ to: '/new', status: 301 }, url, '/site')).toBe('/site/new?utm=1');
		expect(locationFor({ to: 'https://o.test/p', status: 302 }, url, '/site')).toBe('https://o.test/p?utm=1');
	});
});
