// Through core: gates, limits and the panel, on an in-memory D1.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: undefined }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('no request event');
	},
}));
vi.mock('$app/env', () => ({ dev: false, building: false }));

import { collection, defineConfig, fields as f, global } from '@kitcms/core';
import type { KitcmsReq, KitcmsUser } from '@kitcms/core';
import { createTestDb, type TestDb } from '../../core/test/d1';
import { markUploadWrite } from '../../core/src/access/engine';
import { createLocalApi } from '../../core/src/api/local';
import { sanitizeConfig } from '../../core/src/config/sanitize';
import { createD1Adapter } from '../../core/src/db/d1';
import { entitlements } from '../src';

const admin: KitcmsUser = {
	id: 'u1',
	email: 'a@x.io',
	name: 'A',
	role: 'admin',
	collection: 'users',
};

let raw: unknown;
const plugin = entitlements({
	read: () => raw,
	addons: { booking: { label: 'Booking', description: 'Table bookings' }, shop: { label: 'Shop' } },
	manageUrl: 'https://platform.example/plan',
});

const everyone = { read: () => true, create: () => true, update: () => true, delete: () => true };
const input = defineConfig({
	plugins: [plugin],
	collections: [
		collection({ slug: 'pages', access: everyone, fields: { title: f.text() } }),
		collection({
			slug: 'bookings',
			entitlement: 'booking',
			access: everyone,
			fields: { name: f.text() },
		}),
		collection({ slug: 'media', upload: true, access: everyone, fields: {} }),
	],
	globals: [
		global({
			slug: 'hours',
			entitlement: 'booking',
			access: { read: () => true, update: () => true },
			fields: { x: f.text() },
		}),
	],
});
const config = sanitizeConfig(input);

let db: TestDb;
beforeAll(async () => {
	db = await createTestDb(config);
});
afterAll(async () => {
	await db.dispose();
});

const state = (o: object) => JSON.stringify({ plan: 'starter', addons: [], ...o });
beforeEach(() => {
	raw = state({ addons: ['booking'] });
});

const cmsFor = (user: KitcmsUser | null) =>
	createLocalApi({ config, db: createD1Adapter(config, db.d1), user, source: 'local' });
// Upload fields are read-only for ordinary writes; core's upload handler marks its req like this.
const uploadWrite = (cms: ReturnType<typeof cmsFor>, n: number) => {
	const req = { user: admin, context: {}, cms, source: 'admin' } as KitcmsReq;
	markUploadWrite(req);
	const data = {
		filename: 'a.png',
		mimeType: 'image/png',
		filesize: n,
		key: `k${n}-${Math.random()}`,
	};
	return cms.create('media', data as never, { req });
};
const forbidden = { code: 'FORBIDDEN' };

describe('add-on gates (enforced by core)', () => {
	it('works when the add-on is on', async () => {
		const cms = cmsFor(admin);
		const doc = await cms.create('bookings', { name: 'Ada' } as never);
		expect((await cms.find('bookings', {})).docs.map((d: { id: string }) => d.id)).toContain(
			doc.id,
		);
		expect(await cmsFor(null).find('bookings', {})).toBeTruthy();
	});

	it('denies every operation when off, as admin and anonymous', async () => {
		const cms = cmsFor(admin);
		const made = await cms.create('bookings', { name: 'Ada' } as never);
		raw = state({ addons: [] });
		for (const who of [cmsFor(admin), cmsFor(null)]) {
			await expect(who.find('bookings', {})).rejects.toMatchObject(forbidden);
			await expect(who.findByID('bookings', made.id)).rejects.toMatchObject(forbidden);
			await expect(who.create('bookings', { name: 'x' } as never)).rejects.toMatchObject(forbidden);
			await expect(who.update('bookings', made.id, { name: 'y' } as never)).rejects.toMatchObject(
				forbidden,
			);
			await expect(who.delete('bookings', made.id)).rejects.toMatchObject(forbidden);
			await expect(who.count('bookings', {})).rejects.toMatchObject(forbidden);
		}
		await expect(cmsFor(admin).findGlobal('hours')).rejects.toMatchObject(forbidden);
	});

	it('still works with overrideAccess when off', async () => {
		raw = state({ addons: [] });
		const cms = cmsFor(null);
		const doc = await cms.create('bookings', { name: 'Sys' } as never, { overrideAccess: true });
		expect(await cms.findByID('bookings', doc.id, { overrideAccess: true })).toBeTruthy();
	});

	it.each([undefined, '{bad', state({ addons: ['BAD NAME'] })])(
		'missing or invalid value (%s) turns gated features off, ungated keep working',
		async (v) => {
			raw = v;
			await expect(cmsFor(admin).find('bookings', {})).rejects.toMatchObject(forbidden);
			expect(await cmsFor(admin).create('pages', { title: 'ok' } as never)).toBeTruthy();
		},
	);
});

describe('document limits', () => {
	it('rejects a create at the limit, counting only that collection', async () => {
		raw = state({ addons: ['booking'], limits: { documents: { pages: 2 } } });
		const cms = cmsFor(admin);
		const before = await cms.count('pages', { overrideAccess: true });
		for (let i = before; i < 2; i++) await cms.create('pages', { title: `p${i}` } as never);
		await expect(cms.create('pages', { title: 'over' } as never)).rejects.toMatchObject({
			code: 'FORBIDDEN',
			status: 403,
		});
		expect(await cms.count('pages', { overrideAccess: true })).toBe(Math.max(before, 2));
		// Other collections are unaffected, and updates are not creates.
		expect(await cms.create('bookings', { name: 'fine' } as never)).toBeTruthy();
	});

	it('does not block updates', async () => {
		raw = state({});
		const cms = cmsFor(admin);
		const doc = await cms.create('pages', { title: 'a' } as never);
		raw = state({ limits: { documents: { pages: 0 } } });
		expect(await cms.update('pages', doc.id, { title: 'b' } as never)).toBeTruthy();
	});

	it('is skipped with the bypass context flag', async () => {
		raw = state({ limits: { documents: { pages: 0 } } });
		const cms = cmsFor(admin);
		await expect(cms.create('pages', { title: 'x' } as never)).rejects.toMatchObject(forbidden);
		const doc = await cms.create('pages', { title: 'x' } as never, {
			context: { kitcmsEntitlementsBypass: true },
		});
		expect(doc).toBeTruthy();
	});

	it('keeps the existing hooks of a collection', async () => {
		const seen: string[] = [];
		const c = sanitizeConfig(
			defineConfig({
				plugins: [entitlements({ read: () => state({}) })],
				collections: [
					collection({
						slug: 'a',
						fields: {},
						hooks: { beforeChange: () => void seen.push('one') },
					}),
					collection({
						slug: 'b',
						fields: {},
						hooks: { beforeChange: [() => void seen.push('x'), () => void seen.push('y')] },
					}),
				],
			}),
		);
		expect(
			(c.collections.find((x) => x.slug === 'a')!.hooks.beforeChange as unknown[]).length,
		).toBe(2);
		expect(
			(c.collections.find((x) => x.slug === 'b')!.hooks.beforeChange as unknown[]).length,
		).toBe(3);
	});
});

describe('upload size limit', () => {
	it('rejects files over the cap and accepts at the cap', async () => {
		raw = state({ limits: { uploadBytes: 1000 } });
		const cms = cmsFor(admin);
		await expect(uploadWrite(cms, 1001)).rejects.toMatchObject(forbidden);
		expect(await uploadWrite(cms, 1000)).toBeTruthy();
	});
	it('has no cap when unset', async () => {
		expect(await uploadWrite(cmsFor(admin), 10_000_000)).toBeTruthy();
	});
});

describe('no write path', () => {
	it('adds no collections, globals, endpoints, handle or gate of its own', () => {
		const out = plugin.config!(
			defineConfig({ collections: [collection({ slug: 'pages', fields: {} })] }) as never,
		) as typeof input;
		expect(out.collections!.map((c) => c.slug)).toEqual(['pages']);
		expect(out.globals ?? []).toEqual([]);
		expect(plugin.endpoints).toBeUndefined();
		expect(plugin.handle).toBeUndefined();
		expect(plugin.entitlement).toBeUndefined();
		expect(plugin.admin!.panels!.map((p) => p.id)).toEqual(['plan']);
	});
	it('refuses to coexist with another provider', () => {
		expect(() =>
			plugin.config!(defineConfig({ entitlements: { has: () => true }, collections: [] }) as never),
		).toThrow(/already set/);
	});
});

describe('plan panel', () => {
	const load = (user: KitcmsUser | null = admin) => {
		const cms = cmsFor(user);
		const req = { user, context: {}, cms, source: 'admin' } as KitcmsReq;
		return plugin.admin!.panels![0]!.load({ req, cms });
	};

	it('shows the plan, on/locked add-ons, usage and the manage link', async () => {
		raw = state({
			addons: ['booking'],
			limits: { documents: { pages: 100 }, uploadBytes: 5_000_000 },
		});
		const { blocks } = await load();
		expect(blocks[0]).toEqual({ type: 'heading', text: 'Plan: starter' });
		const list = blocks.find((b) => b.type === 'list');
		expect(list).toMatchObject({
			items: [
				{ label: 'Booking', status: 'on' },
				{ label: 'Shop', status: 'locked' },
			],
		});
		const meter = blocks.find((b) => b.type === 'meter');
		expect(meter).toMatchObject({ label: 'pages', limit: 100, unit: 'documents' });
		expect((meter as { used: number }).used).toBe(
			await cmsFor(admin).count('pages', { overrideAccess: true }),
		);
		expect(blocks).toContainEqual({
			type: 'keyValue',
			items: [{ label: 'Largest upload', value: '5 MB' }],
		});
		expect(blocks.at(-1)).toEqual({
			type: 'link',
			label: 'Manage plan',
			href: 'https://platform.example/plan',
		});
	});

	it('warns and locks everything when the value is missing or invalid', async () => {
		for (const v of [undefined, '{bad']) {
			raw = v;
			const { blocks } = await load();
			expect(blocks[0]).toEqual({ type: 'heading', text: 'Plan unknown' });
			expect(blocks).toContainEqual({
				type: 'text',
				tone: 'warning',
				text: 'No plan information found; paid add-ons are off.',
			});
			const list = blocks.find((b) => b.type === 'list') as { items: { status: string }[] };
			expect(list.items.every((i) => i.status === 'locked')).toBe(true);
		}
	});
});
