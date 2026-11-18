// Plugin server code (Decision 33), entitlements (Decision 34) and email (Decision 35).
// SECURITY-CRITICAL paths: endpoint access/origin/rate limit/body cap, handle scope, fail-closed gates.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: undefined }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('no request event');
	},
}));
vi.mock('$app/env', () => ({ dev: false, building: false }));

import { createTestDb, type TestDb } from '../../test/d1';
import { collectionAccess } from '../access/engine';
import { entitled } from '../access/entitlements';
import { safePanelHref, sanitizePanelContent } from '../admin/panel';
import { createLocalApi } from '../api/local';
import { collection, defineConfig, global } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsReq, KitcmsUser } from '../config/hooks';
import type { KitcmsPlugin, PluginEndpointContext } from '../config/plugin';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';
import {
	createCloudflareEmail,
	createConsoleEmail,
	EmailNotConfiguredError,
	emailFor,
	toOutgoing,
} from '../email';
import { isKitcmsError } from '../errors';
import { matchAdminRoute } from './admin';
import type { KitcmsInternals } from './index';
import { cappedBody, handlePluginEndpoint, matchSegments } from './plugins';

const ORIGIN = 'https://site.test';
const admin: KitcmsUser = {
	id: 'u1',
	email: 'a@x.io',
	name: 'A',
	role: 'admin',
	collection: 'users',
};
const stranger: KitcmsUser = {
	id: 'u2',
	email: 'b@x.io',
	name: 'B',
	role: 'nobody',
	collection: 'users',
};

let addons = new Set<string>(['shop']);
let providerThrows = false;
const provider = {
	has(addon: string) {
		if (providerThrows) throw new Error('boom');
		return addons.has(addon);
	},
};

let seen: PluginEndpointContext | null = null;
const echo = (ctx: PluginEndpointContext) => {
	seen = ctx;
	return Response.json({ ok: true, params: ctx.params, user: ctx.user?.id ?? null });
};

const demo: KitcmsPlugin = {
	name: 'demo',
	endpoints: [
		{ method: 'GET', path: 'hello', access: 'public', handler: echo },
		{
			method: 'POST',
			path: 'submit',
			access: 'public',
			maxBodyBytes: 32,
			handler: async (ctx) => Response.json({ body: await ctx.body.json() }),
		},
		{ method: 'GET', path: 'forms/:form', access: 'public', handler: echo },
		{ method: 'GET', path: 'me', access: 'signedIn', handler: echo },
		{ method: 'DELETE', path: 'admin-only', access: 'admin', handler: echo },
		{
			method: 'POST',
			path: 'limited',
			access: 'public',
			rateLimit: { max: 2, window: 60 },
			handler: echo,
		},
	],
	admin: { panels: [{ id: 'status', label: 'Status', load: () => ({ blocks: [] }) }] },
};
const shopPlugin: KitcmsPlugin = {
	name: 'shop',
	entitlement: 'shop',
	endpoints: [{ method: 'GET', path: 'items', access: 'public', handler: echo }],
};

const config = sanitizeConfig(
	defineConfig({
		entitlements: provider,
		plugins: [demo, shopPlugin],
		collections: [
			collection({
				slug: 'pages',
				access: { read: () => true, create: () => true },
				fields: { title: f.text() },
			}),
			collection({
				slug: 'products',
				entitlement: 'shop',
				access: { read: () => true, create: () => true, update: () => true, delete: () => true },
				fields: { name: f.text() },
			}),
		],
		globals: [
			global({
				slug: 'shop-settings',
				entitlement: 'shop',
				access: { read: () => true, update: () => true },
				fields: { x: f.text() },
			}),
		],
	}),
);

let db: TestDb;
beforeAll(async () => {
	db = await createTestDb(config);
});
afterAll(async () => {
	await db.dispose();
});
beforeEach(() => {
	addons = new Set(['shop']);
	providerThrows = false;
	seen = null;
});

function internals(user: KitcmsUser | null): KitcmsInternals {
	const adapter = createD1Adapter(config, db.d1);
	const cmsFor = (u: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') =>
		createLocalApi({ config, db: adapter, user: u, source });
	return {
		config,
		options: { config: {} as never },
		db: adapter,
		env: { DB: db.d1 },
		cms: cmsFor(user),
		user,
		cmsFor,
		email: { enabled: false, send: () => Promise.reject(new EmailNotConfiguredError('test')) },
	};
}

interface Opts {
	origin?: string | null;
	body?: string;
	headers?: Record<string, string>;
}
function event(method: string, path: string, o: Opts = {}): RequestEvent {
	const url = new URL(`${ORIGIN}/api/plugins/${path}`);
	const headers = new Headers(o.headers);
	if (o.origin !== null && method !== 'GET') headers.set('origin', o.origin ?? ORIGIN);
	const init: RequestInit = { method, headers };
	if (o.body !== undefined) init.body = o.body;
	return {
		request: new Request(url, init),
		url,
		params: { path: `plugins/${path}` },
		locals: {},
	} as unknown as RequestEvent;
}
async function call(
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
	path: string,
	user: KitcmsUser | null = null,
	o?: Opts,
) {
	return handlePluginEndpoint(
		event(method, path, o),
		internals(user),
		method,
		path.split('/').filter(Boolean),
	);
}

describe('plugin config validation', () => {
	const base = { collections: [collection({ slug: 'pages', fields: {} })] };
	const bad = (p: unknown) => () =>
		sanitizeConfig(defineConfig({ ...base, plugins: [p as KitcmsPlugin] }));

	it('requires an explicit access on every endpoint', () => {
		expect(bad({ name: 'x', endpoints: [{ method: 'GET', path: 'a', handler: echo }] })).toThrow(
			/access/,
		);
	});
	it('rejects unknown methods, bad paths and duplicate routes', () => {
		expect(
			bad({
				name: 'x',
				endpoints: [{ method: 'PUT', path: 'a', access: 'public', handler: echo }],
			}),
		).toThrow(/method/);
		expect(
			bad({
				name: 'x',
				endpoints: [{ method: 'GET', path: '../a', access: 'public', handler: echo }],
			}),
		).toThrow(/path/);
		expect(
			bad({
				name: 'x',
				endpoints: [
					{ method: 'GET', path: 'a/:id', access: 'public', handler: echo },
					{ method: 'GET', path: 'a/:slug', access: 'public', handler: echo },
				],
			}),
		).toThrow(/duplicate/);
	});
	it('needs a URL-safe plugin name for endpoints and panels', () => {
		expect(
			bad({
				name: 'My Plugin',
				endpoints: [{ method: 'GET', path: 'a', access: 'public', handler: echo }],
			}),
		).toThrow(/name/);
	});
	it('caps maxBodyBytes and validates rate limits', () => {
		expect(
			bad({
				name: 'x',
				endpoints: [
					{
						method: 'POST',
						path: 'a',
						access: 'public',
						maxBodyBytes: 2 * 1024 * 1024,
						handler: echo,
					},
				],
			}),
		).toThrow(/maxBodyBytes/);
		expect(
			bad({
				name: 'x',
				endpoints: [
					{
						method: 'POST',
						path: 'a',
						access: 'public',
						rateLimit: { max: 0, window: 1 },
						handler: echo,
					},
				],
			}),
		).toThrow(/rateLimit/);
	});
	it('rejects duplicate plugin names', () => {
		expect(() =>
			sanitizeConfig(defineConfig({ ...base, plugins: [{ name: 'a' }, { name: 'a' }] })),
		).toThrow(/duplicate plugin/);
	});
	it('a gated collection, global or plugin without a provider is a config error', () => {
		expect(() =>
			sanitizeConfig(
				defineConfig({ collections: [collection({ slug: 'p', entitlement: 'x', fields: {} })] }),
			),
		).toThrow(/entitlements/);
		expect(() =>
			sanitizeConfig(
				defineConfig({ ...base, globals: [global({ slug: 'g', entitlement: 'x', fields: {} })] }),
			),
		).toThrow(/entitlements/);
		expect(() =>
			sanitizeConfig(defineConfig({ ...base, plugins: [{ name: 'p', entitlement: 'x' }] })),
		).toThrow(/entitlements/);
	});
	it('the auth collection cannot be gated', () => {
		expect(() =>
			sanitizeConfig(
				defineConfig({
					entitlements: provider,
					collections: [collection({ slug: 'users', auth: true, entitlement: 'x', fields: {} })],
				}),
			),
		).toThrow(/auth/);
	});
	it('config-only plugins still work (config is optional)', () => {
		const c = sanitizeConfig(defineConfig({ ...base, plugins: [{ name: 'noop' }] }));
		expect(c.plugins).toEqual([]);
	});
});

describe('entitlements: access engine', () => {
	const products = config.collectionsBySlug.products!;
	const site = config.globalsBySlug['shop-settings']!;
	const req = (user: KitcmsUser | null): KitcmsReq => ({
		user,
		context: {},
		cms: {} as never,
		source: 'local',
	});

	it('allows every operation when the add-on is on', async () => {
		for (const op of ['create', 'read', 'update', 'delete'] as const) {
			expect(await collectionAccess(products, op, { req: req(admin) })).toBe(true);
		}
	});
	it('denies every operation, for admins too, when the add-on is off', async () => {
		addons.clear();
		for (const op of ['create', 'read', 'update', 'delete'] as const) {
			expect(await collectionAccess(products, op, { req: req(admin) })).toBe(false);
			expect(await collectionAccess(products, op, { req: req(null) })).toBe(false);
		}
		expect(await collectionAccess(site, 'read', { req: req(null) })).toBe(false);
	});
	it('overrideAccess (trusted code) still works when off', async () => {
		addons.clear();
		expect(await collectionAccess(products, 'read', { req: req(null), overrideAccess: true })).toBe(
			true,
		);
	});
	it('fails closed when the provider throws or returns a non-boolean', async () => {
		providerThrows = true;
		expect(await collectionAccess(products, 'read', { req: req(admin) })).toBe(false);
		providerThrows = false;
		expect(
			await entitled({ entitlements: { has: () => 'yes' as unknown as boolean } }, 'shop'),
		).toBe(false);
		expect(await entitled({}, 'shop')).toBe(false);
		expect(await entitled({}, undefined)).toBe(true);
	});
	it('Local API: reads and writes are forbidden when off, allowed with overrideAccess', async () => {
		const cms = internals(null).cms;
		await cms.create('products', { name: 'Tea' });
		addons.clear();
		await expect(cms.find('products', {})).rejects.toSatisfy(
			(e) => isKitcmsError(e) && e.status === 403,
		);
		await expect(cms.create('products', { name: 'X' })).rejects.toSatisfy(
			(e) => isKitcmsError(e) && e.status === 403,
		);
		await expect(cms.findGlobal('shop-settings' as never)).rejects.toSatisfy(
			(e) => isKitcmsError(e) && e.status === 403,
		);
		const res = await cms.find('products', { overrideAccess: true });
		expect(res.docs.length).toBeGreaterThan(0);
	});
});

describe('plugin endpoints', () => {
	it('dispatches public GETs with params', async () => {
		const res = await call('GET', 'demo/forms/contact');
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ params: { form: 'contact' }, user: null });
		expect(seen?.cms).toBeDefined();
	});
	it('404 for unknown plugins and paths, 405 for a wrong method', async () => {
		expect((await call('GET', 'nope/hello')).status).toBe(404);
		expect((await call('GET', 'demo/nope')).status).toBe(404);
		expect((await call('POST', 'demo/hello')).status).toBe(405);
	});
	it('404 when the plugin add-on is off (and when the provider throws)', async () => {
		expect((await call('GET', 'shop/items')).status).toBe(200);
		addons.clear();
		expect((await call('GET', 'shop/items')).status).toBe(404);
		addons.add('shop');
		providerThrows = true;
		expect((await call('GET', 'shop/items')).status).toBe(404);
	});
	it('non-GET requires a same-origin Origin header', async () => {
		expect((await call('POST', 'demo/submit', null, { origin: null, body: '{}' })).status).toBe(
			403,
		);
		expect(
			(await call('POST', 'demo/submit', null, { origin: 'https://evil.test', body: '{}' })).status,
		).toBe(403);
		expect((await call('POST', 'demo/submit', null, { body: '{"a":1}' })).status).toBe(200);
	});
	it('signedIn and admin access', async () => {
		expect((await call('GET', 'demo/me')).status).toBe(401);
		expect((await call('GET', 'demo/me', stranger)).status).toBe(200);
		expect((await call('DELETE', 'demo/admin-only')).status).toBe(401);
		expect((await call('DELETE', 'demo/admin-only', stranger)).status).toBe(403);
		expect((await call('DELETE', 'demo/admin-only', admin)).status).toBe(200);
	});
	it('caps the body (declared and streamed) with 413', async () => {
		const big = JSON.stringify({ text: 'x'.repeat(100) });
		expect((await call('POST', 'demo/submit', null, { body: big })).status).toBe(413);
		const stream = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(new TextEncoder().encode('{"a":"' + 'y'.repeat(40) + '"}'));
				c.close();
			},
		});
		const body = cappedBody(
			new Request(ORIGIN, { method: 'POST', body: stream, duplex: 'half' } as RequestInit),
			32,
		);
		await expect(body.text()).rejects.toThrow();
	});
	it('invalid JSON is a 400, and the body can only be read once', async () => {
		expect((await call('POST', 'demo/submit', null, { body: '{nope' })).status).toBe(400);
		const body = cappedBody(new Request(ORIGIN, { method: 'POST', body: 'a' }), 10);
		await body.text();
		await expect(body.text()).rejects.toThrow(/already/);
	});
	it('rate limits per IP and per endpoint, with retry-after', async () => {
		const ip = { 'cf-connecting-ip': '203.0.113.9' };
		expect((await call('POST', 'demo/limited', null, { headers: ip })).status).toBe(200);
		expect((await call('POST', 'demo/limited', null, { headers: ip })).status).toBe(200);
		const blocked = await call('POST', 'demo/limited', null, { headers: ip });
		expect(blocked.status).toBe(429);
		expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
		// Another IP has its own bucket.
		expect(
			(
				await call('POST', 'demo/limited', null, {
					headers: { 'cf-connecting-ip': '203.0.113.10' },
				})
			).status,
		).toBe(200);
	});
	it('matchSegments', () => {
		expect(matchSegments(['a', ':id'], ['a', '1'])).toEqual({ id: '1' });
		expect(matchSegments(['a', ':id'], ['a'])).toBeNull();
		expect(matchSegments(['a'], ['b'])).toBeNull();
	});
});

describe('plugin handle (kitcms().handle)', () => {
	it('runs for site paths only, first Response wins, gated plugins skipped', async () => {
		vi.resetModules();
		const workers = await import('cloudflare:workers');
		(workers.env as Record<string, unknown>).DB = db.d1;
		const { kitcms } = await import('./index');
		const calls: string[] = [];
		const { handle } = kitcms({
			config: defineConfig({
				entitlements: provider,
				plugins: [
					{ name: 'gated', entitlement: 'off', handle: () => new Response('gated') },
					{
						name: 'redirects',
						handle: ({ path }) => (
							calls.push(path),
							path === '/old' ? Response.redirect(`${ORIGIN}/new`, 301) : undefined
						),
					},
					{ name: 'later', handle: () => new Response('later') },
				],
				collections: [collection({ slug: 'pages', access: { read: () => true }, fields: {} })],
			}),
		});
		const run = async (path: string) => {
			const url = new URL(`${ORIGIN}${path}`);
			const ev = {
				request: new Request(url),
				url,
				locals: {},
				params: {},
			} as unknown as RequestEvent;
			return handle({ event: ev, resolve: async () => new Response('page') });
		};
		const old = await run('/old');
		expect(old.status).toBe(301);
		expect(await (await run('/about')).text()).toBe('later');
		// Never for the admin or the API.
		calls.length = 0;
		const adminRes = await run('/admin/login').catch(() => null);
		expect(calls).toEqual([]);
		expect(adminRes === null || (await adminRes.text()) !== 'later').toBe(true);
	});
});

describe('admin panels', () => {
	it('routes /admin/plugins/<plugin>/<panel>', () => {
		expect(matchAdminRoute('plugins/demo/status')).toEqual({
			view: 'panel',
			plugin: 'demo',
			panel: 'status',
		});
		expect(matchAdminRoute('plugins/demo')).toBeNull();
	});
	it('drops unsafe links and malformed blocks', () => {
		const out = sanitizePanelContent({
			blocks: [
				{ type: 'link', label: 'Manage', href: 'https://dash.example.com' },
				{ type: 'link', label: 'XSS', href: 'javascript:alert(1)' },
				{ type: 'link', label: 'Proto-relative', href: '//evil.test' },
				{ type: 'meter', label: 'Pages', used: 3, limit: null },
				{ type: 'meter', label: 'Bad', used: 'x', limit: 2 },
				{ type: 'list', items: [{ label: 'Booking', status: 'locked' }, { nope: 1 }] },
				{ type: 'script', text: 'x' },
			],
		});
		expect(out.blocks).toEqual([
			{ type: 'link', label: 'Manage', href: 'https://dash.example.com' },
			{ type: 'meter', label: 'Pages', used: 3, limit: null },
			{ type: 'list', items: [{ label: 'Booking', status: 'locked' }] },
		]);
		expect(safePanelHref('/admin')).toBe('/admin');
		expect(safePanelHref('/\\evil.test')).toBeNull();
		expect(safePanelHref('http://x.test')).toBeNull();
	});
});

describe('email', () => {
	const settings = { from: { address: 'hello@hotel.test', name: 'Hotel' } };
	const emailConfig = sanitizeConfig(
		defineConfig({ email: settings, collections: [collection({ slug: 'pages', fields: {} })] }),
	);

	it('validates config', () => {
		expect(() =>
			sanitizeConfig(defineConfig({ email: { from: { address: 'nope' } }, collections: [] })),
		).toThrow(/address/);
		expect(() =>
			sanitizeConfig(
				defineConfig({
					email: { from: { address: 'a@b.co', name: 'A\r\nBcc: x@y.z' } },
					collections: [],
				}),
			),
		).toThrow(/name/);
	});
	it('rejects header injection in recipients and subject', () => {
		expect(() =>
			toOutgoing(settings, { to: 'a@b.co\r\nBcc: x@y.z', subject: 'Hi', text: 'x' }),
		).toThrow();
		expect(() =>
			toOutgoing(settings, { to: 'a@b.co', subject: 'Hi\r\nBcc: x@y.z', text: 'x' }),
		).toThrow();
		expect(() => toOutgoing(settings, { to: [], subject: 'Hi', text: 'x' })).toThrow();
		expect(toOutgoing(settings, { to: 'a@b.co', subject: ' Hi ', text: 'x' })).toMatchObject({
			to: ['a@b.co'],
			subject: 'Hi',
			from: settings.from,
		});
	});
	it('is disabled without config or binding, with a clear error', async () => {
		const none = emailFor(config, {}, false);
		expect(none.enabled).toBe(false);
		await expect(none.send({ to: 'a@b.co', subject: 's', text: 't' })).rejects.toThrow(
			/email: \{ from \}/,
		);
		const noBinding = emailFor(emailConfig, {}, false);
		expect(noBinding.enabled).toBe(false);
		await expect(noBinding.send({ to: 'a@b.co', subject: 's', text: 't' })).rejects.toThrow(
			/EMAIL/,
		);
	});
	it('sends through the binding (builder form) in production', async () => {
		const sent: unknown[] = [];
		const binding = { send: async (m: unknown) => (sent.push(m), { messageId: 'm1' }) };
		const sender = emailFor(emailConfig, { EMAIL: binding }, false);
		expect(sender.enabled).toBe(true);
		expect(
			await sender.send({ to: 'guest@x.co', subject: 'Thanks', text: 'Hi', html: '<p>Hi</p>' }),
		).toEqual({ messageId: 'm1' });
		expect(sent[0]).toEqual({
			from: { email: 'hello@hotel.test', name: 'Hotel' },
			to: 'guest@x.co',
			subject: 'Thanks',
			text: 'Hi',
			html: '<p>Hi</p>',
		});
		const plain = createCloudflareEmail({ send: async () => undefined });
		expect(
			await plain.send({
				from: { address: 'a@b.co' },
				to: ['x@y.co', 'z@y.co'],
				subject: 's',
				text: 't',
			}),
		).toEqual({ messageId: null });
	});
	it('logs instead of sending in dev', async () => {
		const lines: unknown[] = [];
		const adapter = createConsoleEmail((...a) => lines.push(...a));
		await adapter.send({
			from: { address: 'a@b.co' },
			to: ['x@y.co'],
			subject: 'Dev',
			text: 'body',
		});
		expect(String(lines[0])).toContain('Subject: Dev');
		expect(emailFor(emailConfig, {}, true).enabled).toBe(true);
	});
});
