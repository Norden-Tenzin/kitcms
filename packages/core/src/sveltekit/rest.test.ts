// REST fallback API (plan §13.7): handlers over a real Miniflare D1 Local API. Security-relevant:
// CSRF, caller identity, rest:false, body limits.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createTestDb, type TestDb } from '../../test/d1';
import { createLocalApi } from '../api/local';
import { collection, defineConfig, global } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';

let current: KitcmsInternals;
vi.mock('./index', () => ({ getKitcms: () => current }));

import { DELETE, GET, PATCH, POST } from './api';
import { handleRest, MAX_BODY_BYTES, type RestMethod } from './rest';
import type { KitcmsInternals } from './index';

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({
				slug: 'media',
				upload: true,
				access: { read: () => true, update: () => true },
				fields: { alt: f.text() },
			}),
			collection({
				slug: 'pages',
				access: {
					read: ({ req }) => (req.user ? true : { status: { equals: 'published' } }),
				},
				fields: {
					title: f.text({ required: true }),
					status: f.select({ options: ['draft', 'published'], defaultValue: 'draft' }),
					cover: f.upload({ relationTo: 'media' }),
				},
			}),
			collection({ slug: 'notes', fields: { body: f.text() } }),
			collection({ slug: 'open', access: { read: () => true, create: () => true }, fields: { name: f.text() } }),
		],
		globals: [
			global({ slug: 'site', access: { read: () => true }, fields: { siteName: f.text({ defaultValue: 'My site' }) } }),
			global({ slug: 'secret', fields: { note: f.text() } }),
		],
	}),
);
const offConfig = sanitizeConfig(defineConfig({ rest: false, collections: [collection({ slug: 'pages', access: { read: () => true }, fields: {} })] }));

const user: KitcmsUser = { id: 'u1', email: 'a@x.io', name: 'A', role: 'admin', collection: 'users' };
const ORIGIN = 'https://site.test';

let db: TestDb;
let offDb: TestDb;
let moved: unknown[][] = [];

function internalsFor(cfg: typeof config, d1: D1Database, u: KitcmsUser | null, hide: string[] = []): KitcmsInternals {
	const adapter = createD1Adapter(cfg, d1);
	const cmsFor = (usr: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') => {
		const real = createLocalApi({ config: cfg, db: adapter, user: usr, source });
		return new Proxy(real as object, {
			get(t, p, r) {
				if (typeof p === 'string' && hide.includes(p)) return undefined;
				if (p === 'move') {
					return (...a: unknown[]) => (moved.push(['move', ...a, { user: usr, source }]), Promise.resolve({ id: a[1] }));
				}
				if (p === 'unpublish') {
					return (...a: unknown[]) => (moved.push(['unpublish', ...a]), Promise.resolve({ id: a[1] }));
				}
				const v = Reflect.get(t, p, r) as unknown;
				return typeof v === 'function' ? (v as (...x: unknown[]) => unknown).bind(t) : v;
			},
		}) as never;
	};
	return { config: cfg, options: { config: {} as never }, db: adapter, env: {}, cms: cmsFor(u), user: u, cmsFor, tenant: null, hostTenant: null };
}

interface Opts {
	origin?: string | null;
	body?: unknown;
	raw?: string | Uint8Array;
	type?: string | null;
	headers?: Record<string, string>;
}
function event(method: string, path: string, o: Opts = {}): RequestEvent {
	const url = new URL(`${ORIGIN}/api/${path}`);
	const headers = new Headers(o.headers);
	if (o.origin !== null && method !== 'GET') headers.set('origin', o.origin ?? ORIGIN);
	const hasBody = method !== 'GET' && (o.body !== undefined || o.raw !== undefined);
	if (hasBody && o.type !== null) headers.set('content-type', o.type ?? 'application/json');
	const init: RequestInit = { method, headers };
	if (hasBody) init.body = (o.raw ?? JSON.stringify(o.body)) as BodyInit;
	return { request: new Request(url, init), url, params: { path: path.split('?')[0] }, locals: {} } as unknown as RequestEvent;
}
const handlers = { GET, POST, PATCH, DELETE };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>;
async function call(method: keyof typeof handlers, path: string, o?: Opts) {
	const res = await handlers[method](event(method, path, o));
	const text = await res.text();
	let body: Body = {};
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		/* non-json */
	}
	return { res, status: res.status, body };
}

beforeAll(async () => {
	db = await createTestDb(config);
	offDb = await createTestDb(offConfig);
});
afterAll(async () => {
	await db.dispose();
	await offDb.dispose();
});
beforeEach(() => {
	moved = [];
	current = internalsFor(config, db.d1, user);
});

async function seedPage(title: string, status = 'published') {
	return createLocalApi({ config, db: createD1Adapter(config, db.d1), user, source: 'local' }).create('pages', {
		title,
		status,
	} as never);
}

describe('reads', () => {
	it('find returns PaginatedDocs with no-store JSON', async () => {
		await seedPage('Hello');
		const { res, status, body } = await call('GET', 'collections/pages');
		expect(status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(res.headers.get('content-type')).toContain('application/json');
		expect(body.docs.length).toBeGreaterThan(0);
		expect(body).toHaveProperty('totalDocs');
	});

	it('where / sort / limit / page / pagination / depth', async () => {
		await seedPage('Zeta');
		await seedPage('Alpha');
		const where = encodeURIComponent(JSON.stringify({ title: { equals: 'Alpha' } }));
		let r = await call('GET', `collections/pages?where=${where}`);
		expect(r.body.docs.map((d: { title: string }) => d.title)).toEqual(['Alpha']);
		r = await call('GET', 'collections/pages?sort=title&limit=1&page=1');
		expect(r.body.docs).toHaveLength(1);
		expect(r.body.limit).toBe(1);
		r = await call('GET', 'collections/pages?pagination=false');
		expect(r.status).toBe(200);
		expect(Array.isArray(r.body.docs)).toBe(true);
		r = await call('GET', 'collections/pages?depth=1');
		expect(r.status).toBe(200);
	});

	it.each([
		['where=notjson'],
		['where=[1]'],
		['where=null'],
		['where=%22str%22'],
		['limit=abc'],
		['limit=1.5'],
		['limit=-1'],
		['limit=0'],
		['limit=1e3'],
		['limit='],
		['page=0'],
		['page=x'],
		['depth=3'],
		['depth=1.0'],
		['pagination=nope'],
		['draft=yes'],
		['sort='],
	])('rejects bad query %s with 400', async (q) => {
		const r = await call('GET', `collections/pages?${q}`);
		expect(r.status).toBe(400);
		expect(typeof r.body.error).toBe('string');
	});

	it('unknown where field is a 400 QUERY error from the pipeline', async () => {
		const where = encodeURIComponent(JSON.stringify({ nope: { equals: 1 } }));
		const r = await call('GET', `collections/pages?where=${where}`);
		expect(r.status).toBe(400);
		expect(r.body.code).toBe('QUERY');
	});

	it('findByID returns the doc, 404 when missing', async () => {
		const d = await seedPage('One');
		expect((await call('GET', `collections/pages/${d.id}`)).body.title).toBe('One');
		const r = await call('GET', 'collections/pages/NOPE');
		expect(r.status).toBe(404);
		expect(r.body).toHaveProperty('error');
	});

	it('globals: findGlobal returns defaults', async () => {
		const r = await call('GET', 'globals/site');
		expect(r.status).toBe(200);
		expect(r.body.siteName).toBe('My site');
	});
});

describe('anonymous access', () => {
	beforeEach(() => {
		current = internalsFor(config, db.d1, null);
	});
	it('reads public rules but not drafts', async () => {
		await seedPage('Pub', 'published');
		await seedPage('Hidden', 'draft');
		const r = await call('GET', 'collections/pages?limit=100');
		const titles = r.body.docs.map((d: { title: string }) => d.title);
		expect(titles).toContain('Pub');
		expect(titles).not.toContain('Hidden');
	});
	it('private collections deny by default', async () => {
		const r = await call('GET', 'collections/notes');
		expect(r.status).toBe(403);
		expect(r.body.code).toBe('FORBIDDEN');
		expect((await call('GET', 'globals/secret')).status).toBe(403);
	});
	it('writes are denied by default rules (reach the pipeline)', async () => {
		expect((await call('POST', 'collections/pages', { body: { title: 'x' } })).status).toBe(403);
		expect((await call('POST', 'collections/notes', { body: { body: 'x' } })).status).toBe(403);
		expect((await call('PATCH', 'globals/site', { body: { siteName: 'x' } })).status).toBe(403);
		const d = await seedPage('keep');
		expect((await call('PATCH', `collections/pages/${d.id}`, { body: { title: 'x' } })).status).toBe(403);
		expect((await call('DELETE', `collections/pages/${d.id}`)).status).toBe(403);
	});
	it('an open-access collection still allows anonymous create', async () => {
		const r = await call('POST', 'collections/open', { body: { name: 'a' } });
		expect(r.status).toBe(201);
	});
	it('anonymous draft=true reads are refused', async () => {
		expect((await call('GET', 'collections/pages?draft=true')).status).toBe(403);
		expect((await call('GET', 'globals/site?draft=true')).status).toBe(403);
	});
});

describe('writes (signed in)', () => {
	it('create 201, update, delete', async () => {
		const c = await call('POST', 'collections/pages', { body: { title: 'New' } });
		expect(c.status).toBe(201);
		expect(c.body.title).toBe('New');
		const u = await call('PATCH', `collections/pages/${c.body.id}`, { body: { title: 'Newer' } });
		expect(u.status).toBe(200);
		expect(u.body.title).toBe('Newer');
		const d = await call('DELETE', `collections/pages/${c.body.id}`);
		expect(d.status).toBe(200);
		expect(d.body.id).toBe(c.body.id);
		expect((await call('GET', `collections/pages/${c.body.id}`)).status).toBe(404);
	});
	it('update/delete of a missing doc is 404', async () => {
		expect((await call('PATCH', 'collections/pages/NOPE', { body: { title: 'x' } })).status).toBe(404);
		expect((await call('DELETE', 'collections/pages/NOPE')).status).toBe(404);
	});
	it('validation errors are 400 with errors[]', async () => {
		const r = await call('POST', 'collections/pages', { body: {} });
		expect(r.status).toBe(400);
		expect(r.body.code).toBe('VALIDATION');
		expect(r.body.errors[0]).toMatchObject({ path: 'title' });
	});
	it('referenced delete is 409 with references', async () => {
		const m = await call('POST', 'collections/pages', { body: { title: 'p' } });
		const media = await createLocalApi({ config, db: createD1Adapter(config, db.d1), user, source: 'local' }).create(
			'media',
			{ alt: 'a', filename: 'a.png', mimeType: 'image/png', filesize: 1, key: 'k/rest.png' } as never,
			{ overrideAccess: true },
		);
		await call('PATCH', `collections/pages/${m.body.id}`, { body: { cover: media.id } });
		const r = await call('DELETE', `collections/media/${media.id}`);
		expect(r.status).toBe(409);
		expect(r.body.code).toBe('REFERENCED');
		expect(r.body.references.length).toBeGreaterThan(0);
	});
	it('updateGlobal', async () => {
		const r = await call('PATCH', 'globals/site', { body: { siteName: 'Renamed' } });
		expect(r.status).toBe(200);
		expect(r.body.siteName).toBe('Renamed');
		expect((await call('GET', 'globals/site')).body.siteName).toBe('Renamed');
	});
	it('upload collections: no REST create (405), metadata PATCH ok', async () => {
		const r = await call('POST', 'collections/media', { body: { alt: 'x' } });
		expect(r.status).toBe(405);
		expect(r.res.headers.get('allow')).toBe('GET');
		const media = await createLocalApi({ config, db: createD1Adapter(config, db.d1), user, source: 'local' }).create(
			'media',
			{ alt: 'a', filename: 'b.png', mimeType: 'image/png', filesize: 1, key: 'k/rest2.png' } as never,
			{ overrideAccess: true },
		);
		const p = await call('PATCH', `collections/media/${media.id}`, { body: { alt: 'new alt' } });
		expect(p.status).toBe(200);
		expect(p.body.alt).toBe('new alt');
	});
	it('auth collection: POST is 405; reads go through its strict access', async () => {
		const r = await call('POST', `collections/${config.authCollection}`, { body: { email: 'x@y.z' } });
		expect(r.status).toBe(405);
		current = internalsFor(config, db.d1, null);
		const anon = await call('GET', `collections/${config.authCollection}`);
		expect(anon.status).toBe(403);
	});
});

describe('CSRF (Origin)', () => {
	const cases: [keyof typeof handlers, string, unknown][] = [
		['POST', 'collections/pages', { title: 'csrf' }],
		['PATCH', 'collections/pages/X', { title: 'csrf' }],
		['DELETE', 'collections/pages/X', undefined],
		['PATCH', 'globals/site', { siteName: 'csrf' }],
		['POST', 'collections/pages/X/move', { after: 'Y' }],
		['POST', 'collections/pages/X/unpublish', undefined],
	];
	for (const [m, p, body] of cases) {
		it(`${m} ${p}: missing / foreign / look-alike origin → 403, same origin passes the check`, async () => {
			for (const origin of [null, 'https://evil.test', `${ORIGIN}.evil.test`, 'null', 'http://site.test']) {
				const r = await call(m, p, { origin, body });
				expect(r.status).toBe(403);
				expect(r.body.error).toMatch(/cross-origin/i);
			}
			const ok = await call(m, p, { origin: ORIGIN, body });
			expect(ok.status).not.toBe(403 as number);
		});
	}
	it('CSRF is checked before the body is read (bad content-type/oversize still 403)', async () => {
		const r = await call('POST', 'collections/pages', { origin: null, raw: 'x', type: 'text/plain' });
		expect(r.status).toBe(403);
		const big = await call('POST', 'collections/pages', {
			origin: 'https://evil.test',
			raw: 'x'.repeat(MAX_BODY_BYTES + 5),
		});
		expect(big.status).toBe(403);
	});
	it('GET needs no Origin', async () => {
		expect((await call('GET', 'collections/pages')).status).toBe(200);
	});
});

describe('bodies', () => {
	it('415 for non-JSON content-type', async () => {
		for (const type of ['text/plain', 'multipart/form-data', 'application/x-www-form-urlencoded', null]) {
			const r = await call('POST', 'collections/pages', { raw: '{"title":"x"}', type });
			expect(r.status).toBe(415);
		}
	});
	it('accepts a charset parameter', async () => {
		const r = await call('POST', 'collections/pages', { body: { title: 'cs' }, type: 'application/json; charset=utf-8' });
		expect(r.status).toBe(201);
	});
	it('413 by Content-Length and by actual bytes', async () => {
		const big = JSON.stringify({ title: 'x'.repeat(MAX_BODY_BYTES) });
		const a = await call('POST', 'collections/pages', { raw: big });
		expect(a.status).toBe(413);
		// Lying Content-Length: the stream is counted anyway.
		const e = event('POST', 'collections/pages', { raw: big });
		const headers = new Headers(e.request.headers);
		headers.set('content-length', '10');
		const stream = new ReadableStream({
			start(c) {
				c.enqueue(new TextEncoder().encode(big));
				c.close();
			},
		});
		const req = new Request(e.url, { method: 'POST', headers, body: stream, duplex: 'half' } as RequestInit);
		const res = await POST({ ...e, request: req } as RequestEvent);
		expect(res.status).toBe(413);
	});
	it('400 for invalid JSON and non-object JSON', async () => {
		for (const raw of ['{', '', '[]', 'null', '"s"', '1', 'true']) {
			const r = await call('POST', 'collections/pages', { raw });
			expect(r.status).toBe(400);
		}
	});
	it('400 for invalid UTF-8', async () => {
		const r = await call('POST', 'collections/pages', { raw: new Uint8Array([0x7b, 0xff, 0x7d]) });
		expect(r.status).toBe(400);
	});
});

describe('routing', () => {
	it('unknown collection/global → 404, extra segments → 404', async () => {
		expect((await call('GET', 'collections/nope')).status).toBe(404);
		expect((await call('GET', 'collections/__proto__')).status).toBe(404);
		expect((await call('GET', 'collections/constructor/x')).status).toBe(404);
		expect((await call('GET', 'globals/nope')).status).toBe(404);
		expect((await call('GET', 'globals/__proto__')).status).toBe(404);
		expect((await call('GET', 'collections/pages/X/move/extra')).status).toBe(404);
		expect((await call('GET', 'collections/pages/X/other')).status).toBe(404);
		expect((await call('GET', 'globals/site/x')).status).toBe(404);
		expect((await call('GET', 'collections')).status).toBe(404);
		expect((await call('GET', 'whatever')).status).toBe(404);
		expect((await call('PATCH', 'whatever')).status).toBe(404);
		expect((await call('DELETE', 'admin/search/pages')).status).toBe(404);
	});
	it('wrong methods → 405 with Allow', async () => {
		const cases: [keyof typeof handlers, string, string][] = [
			['PATCH', 'collections/pages', 'GET, POST'],
			['DELETE', 'collections/pages', 'GET, POST'],
			['POST', 'collections/pages/X', 'GET, PATCH, DELETE'],
			['GET', 'collections/pages/X/move', 'POST'],
			['PATCH', 'collections/pages/X/unpublish', 'POST'],
			['POST', 'globals/site', 'GET, PATCH'],
			['DELETE', 'globals/site', 'GET, PATCH'],
		];
		for (const [m, p, allow] of cases) {
			const r = await call(m, p, { body: {} });
			expect(r.status, `${m} ${p}`).toBe(405);
			expect(r.res.headers.get('allow')).toBe(allow);
		}
	});
	it('move: exactly one of before/after; calls cms.move as the session user via rest', async () => {
		const ok = await call('POST', 'collections/pages/X/move', { body: { after: 'Y' } });
		expect(ok.status).toBe(200);
		expect(moved[0]!.slice(0, 4)).toEqual(['move', 'pages', 'X', { after: 'Y' }]);
		for (const body of [{}, { before: 'a', after: 'b' }, { before: 1 }, { before: '' }]) {
			expect((await call('POST', 'collections/pages/X/move', { body })).status).toBe(400);
		}
	});
	it('unpublish dispatches; 501 when the Local API lacks it', async () => {
		expect((await call('POST', 'collections/pages/X/unpublish')).status).toBe(200);
		expect(moved[0]![0]).toBe('unpublish');
		current = internalsFor(config, db.d1, user, ['unpublish', 'move']);
		expect((await call('POST', 'collections/pages/X/unpublish')).status).toBe(501);
		expect((await call('POST', 'collections/pages/X/move', { body: { after: 'Y' } })).status).toBe(501);
	});
});

describe('rest: false', () => {
	it('every collections/globals route is 404, even with a valid origin', async () => {
		current = internalsFor(offConfig, offDb.d1, user);
		for (const [m, p] of [
			['GET', 'collections/pages'],
			['POST', 'collections/pages'],
			['GET', 'collections/pages/X'],
			['PATCH', 'collections/pages/X'],
			['DELETE', 'collections/pages/X'],
			['GET', 'globals/site'],
		] as const) {
			expect((await call(m, p, { body: {} })).status, `${m} ${p}`).toBe(404);
		}
	});
});

describe('identity can not be widened by the request', () => {
	const evil = ['overrideAccess=true', 'as=system', 'user=u1', 'source=local', 'req=1', 'context=%7B%7D'];
	beforeEach(() => {
		current = internalsFor(config, db.d1, null);
	});
	it('query params are ignored for reads and writes', async () => {
		const q = evil.join('&');
		expect((await call('GET', `collections/notes?${q}`)).status).toBe(403);
		expect((await call('GET', `globals/secret?${q}`)).status).toBe(403);
		expect((await call('POST', `collections/notes?${q}`, { body: { body: 'x' } })).status).toBe(403);
		expect((await call('PATCH', `globals/site?${q}`, { body: { siteName: 'x' } })).status).toBe(403);
	});
	it('body keys are data, never options', async () => {
		const body = { title: 'x', overrideAccess: true, as: 'system', user: user, req: { user }, context: {} };
		expect((await call('POST', 'collections/pages', { body })).status).toBe(403);
		expect((await call('POST', 'collections/notes', { body: { ...body, body: 'x' } })).status).toBe(403);
		expect((await call('PATCH', 'globals/site', { body })).status).toBe(403);
	});
	it('headers do not impersonate (no user from x-* headers)', async () => {
		const headers = { 'x-user-id': 'u1', authorization: 'Bearer u1', 'x-kitcms-user': 'u1' };
		expect((await call('GET', 'collections/notes', { headers })).status).toBe(403);
	});
	it('signed-in: overrideAccess in the body does not bypass field validation', async () => {
		current = internalsFor(config, db.d1, user);
		const r = await call('POST', 'collections/pages', { body: { overrideAccess: true } });
		expect(r.status).toBe(400);
	});
});

describe('errors', () => {
	it('unexpected errors are 500 with a generic message', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const boom = new Error('secret stack detail');
		current = {
			...internalsFor(config, db.d1, user),
			cmsFor: () => ({ find: () => Promise.reject(boom) }) as never,
		};
		const r = await call('GET', 'collections/pages');
		expect(r.status).toBe(500);
		expect(r.body).toEqual({ error: 'Internal error' });
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
	it('handleRest never throws', async () => {
		const res = await handleRest(event('GET', 'collections/pages'), current, 'GET' as RestMethod, ['collections', 'pages']);
		expect(res.status).toBe(200);
	});
});
