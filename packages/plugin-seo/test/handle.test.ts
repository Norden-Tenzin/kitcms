// Integration: redirects, sitemap and robots through `kitcms().handle` with a real (Miniflare) D1.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: undefined }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('no request event');
	},
}));
vi.mock('$app/env', () => ({ dev: false, building: false }));

import { collection, defineConfig, fields as f } from '@kitcms/core';
import { createTestDb, type TestDb } from '../../core/test/d1';
import { createLocalApi } from '../../core/src/api/local';
import { sanitizeConfig } from '../../core/src/config/sanitize';
import { createD1Adapter } from '../../core/src/db/d1';
import { seo } from '../src';

const ORIGIN = 'https://site.test';
const editor = { id: 'u1', email: 'a@x.io', name: 'A', role: 'admin', collection: 'users' };

const config = defineConfig({
	plugins: [
		seo({
			collections: ['pages', 'rooms'],
			redirects: true,
			sitemap: {
				collections: {
					pages: (doc) => (doc.slug === 'home' ? '/' : `/${doc.slug}`),
					rooms: '/rooms/:slug',
					secret: '/secret/:slug',
				},
				paths: ['/rooms'],
			},
			robots: { disallow: ['/private'] },
		}),
	],
	collections: [
		collection({
			slug: 'pages',
			versions: { drafts: true },
			access: { read: () => true },
			fields: { slug: f.text({ required: true }), title: f.text() },
		}),
		collection({
			slug: 'rooms',
			access: { read: () => true },
			fields: { slug: f.text({ required: true }) },
		}),
		collection({ slug: 'secret', fields: { slug: f.text() } }),
	],
} as never);
const sanitized = sanitizeConfig(config);

let db: TestDb;
let cms: ReturnType<typeof createLocalApi>;
let handle: (a: { event: RequestEvent; resolve: () => Promise<Response> }) => Promise<Response>;
type Loose = { create(s: string, d: unknown, o?: unknown): Promise<{ id: string }>; update(...a: unknown[]): Promise<unknown>; delete(...a: unknown[]): Promise<unknown> };
let api: Loose;

const run = (path: string, method = 'GET') => {
	const url = new URL(`${ORIGIN}${path}`);
	const event = { request: new Request(url, { method }), url, locals: {}, params: {} } as unknown as RequestEvent;
	return handle({ event, resolve: async () => new Response('page') });
};

beforeAll(async () => {
	db = await createTestDb(sanitized);
	cms = createLocalApi({ config: sanitized, db: createD1Adapter(sanitized, db.d1), user: editor as never, source: 'local' });
	api = cms as unknown as Loose;
	vi.resetModules();
	const workers = await import('cloudflare:workers');
	(workers.env as Record<string, unknown>).DB = db.d1;
	const { kitcms } = await import('../../core/src/sveltekit/index');
	handle = kitcms({ config }).handle as never;
});
afterAll(async () => {
	await db.dispose();
});

/** The messages of the ValidationError a promise rejects with. */
const invalid = async (p: Promise<unknown>): Promise<string> => {
	try {
		await p;
	} catch (err) {
		return ((err as { errors?: { message: string }[] }).errors ?? []).map((e) => e.message).join(' | ') || String(err);
	}
	return 'RESOLVED';
};

describe('redirects', () => {
	it('is signed-in only and appears in the config', () => {
		const c = sanitized.collectionsBySlug.redirects!;
		expect(c.access?.read).toBeUndefined();
		expect(c.admin?.group).toBe('SEO');
	});

	it('301/302 with the query preserved, disabled ignored, cache invalidated on write', async () => {
		expect((await run('/old')).status).toBe(200); // empty cache is cached too
		const r = await api.create('redirects', { from: '/old/', to: '/new' });
		const res = await run('/old?utm=1');
		expect(res.status).toBe(301);
		expect(res.headers.get('location')).toBe('/new?utm=1');
		expect((await run('/old/')).status).toBe(301); // trailing slash normalized

		await api.create('redirects', { from: '/tmp', to: 'https://other.test/x?a=1', type: '302' });
		const ext = await run('/tmp?b=2');
		expect(ext.status).toBe(302);
		expect(ext.headers.get('location')).toBe('https://other.test/x?a=1');

		await api.create('redirects', { from: '/off', to: '/new', enabled: false });
		expect((await run('/off')).status).toBe(200);

		await api.update('redirects', r.id, { enabled: false });
		expect((await run('/old')).status).toBe(200);
		await api.update('redirects', r.id, { enabled: true });
		expect((await run('/old')).status).toBe(301);
		await api.delete('redirects', r.id);
		expect((await run('/old')).status).toBe(200);
	});

	it('only GET/HEAD, and never /admin or /api', async () => {
		await api.create('redirects', { from: '/post-me', to: '/new' });
		expect((await run('/post-me', 'POST')).status).toBe(200);
		expect((await run('/post-me', 'HEAD')).status).toBe(301);
		await expect(api.create('redirects', { from: '/admin', to: '/x' })).rejects.toThrow();
		await expect(api.create('redirects', { from: '/api/x', to: '/x' })).rejects.toThrow();
		const adminRes = await run('/admin/login').catch(() => null);
		expect(adminRes === null || adminRes.status !== 301).toBe(true);
	});

	it('rejects self redirects, loops, bad targets and duplicates', async () => {
		expect(await invalid(api.create('redirects', { from: '/self', to: '/self/' }))).toMatch(/itself/);
		await api.create('redirects', { from: '/a', to: '/b' });
		await api.create('redirects', { from: '/b', to: '/c' });
		expect(await invalid(api.create('redirects', { from: '/c', to: '/a' }))).toMatch(/loop/);
		const c = await api.create('redirects', { from: '/c', to: '/z' });
		expect(await invalid(api.update('redirects', c.id, { to: '/a' }))).toMatch(/loop/);
		// A disabled redirect cannot loop.
		await api.create('redirects', { from: '/d', to: '/a', enabled: false });
		for (const to of ['javascript:alert(1)', '//evil.test', 'ftp://x.test', 'new', 'data:text/html,x']) {
			await expect(api.create('redirects', { from: `/bad${Math.random()}`, to })).rejects.toThrow();
		}
		await expect(api.create('redirects', { from: '/a', to: '/other' })).rejects.toThrow();
	});
});

describe('sitemap and robots', () => {
	it('lists published docs only, skips noIndex, denied collections and bad docs', async () => {
		await api.create('pages', { slug: 'home', title: 'Home' });
		await api.create('pages', { slug: 'about', title: 'About' });
		await api.create('pages', { slug: 'hidden', title: 'H', meta: { noIndex: true } });
		await api.create('pages', { slug: 'wip', title: 'WIP' }, { draft: true });
		await api.create('rooms', { slug: 'big room' });
		await api.create('secret', { slug: 'nope' });

		const res = await run('/sitemap.xml');
		expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
		expect(res.headers.get('cache-control')).toBe('public, max-age=300');
		const xml = await res.text();
		expect(xml).toContain(`<loc>${ORIGIN}/rooms</loc>`);
		expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
		expect(xml).toContain(`<loc>${ORIGIN}/about</loc>`);
		expect(xml).toContain(`<loc>${ORIGIN}/rooms/big%20room</loc>`);
		expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
		expect(xml).not.toContain('hidden');
		expect(xml).not.toContain('wip');
		expect(xml).not.toContain('secret');
	});

	it('robots.txt links the sitemap', async () => {
		const res = await run('/robots.txt');
		expect(res.headers.get('content-type')).toContain('text/plain');
		expect(await res.text()).toBe(
			`User-agent: *\nDisallow: /admin\nDisallow: /api\nDisallow: /private\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
		);
	});
});

describe('config validation', () => {
	const base = (opts: Parameters<typeof seo>[0]) =>
		sanitizeConfig(
			defineConfig({ plugins: [seo(opts)], collections: [collection({ slug: 'pages', fields: {} })] } as never),
		);
	it('fails on unknown collections, bad patterns and existing slugs', () => {
		expect(() => base({ sitemap: { collections: { nope: '/x' } } })).toThrow(/does not exist/);
		expect(() => base({ sitemap: { collections: { pages: 'x/:slug' } } })).toThrow(/start with/);
		expect(() => base({ sitemap: { collections: {}, paths: ['x'] } })).toThrow(/start with/);
		expect(() => base({ sitemap: { collections: {}, origin: 'nope' } })).toThrow(/origin/);
		expect(() => base({ redirects: { collection: 'pages' } })).toThrow(/already exists/);
	});
	it('a custom origin is used', async () => {
		const c = defineConfig({
			plugins: [seo({ sitemap: { collections: {}, paths: ['/a'], origin: 'https://example.com/' } })],
			collections: [],
		} as never);
		const { handle: h } = (await import('../../core/src/sveltekit/index')).kitcms({ config: c });
		const url = new URL(`${ORIGIN}/sitemap.xml`);
		const ev = { request: new Request(url), url, locals: {}, params: {} } as unknown as RequestEvent;
		const xml = await (await h({ event: ev, resolve: async () => new Response('x') })).text();
		expect(xml).toContain('<loc>https://example.com/a</loc>');
	});
});
