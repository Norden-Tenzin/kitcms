// `defineSeed` helpers against Miniflare D1 (not through wrangler).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../test/d1';
import { createLocalApi } from './api/local';
import type { Cms } from './api/types';
import { collection, defineConfig, global } from './config/collection';
import { fields as f } from './config/fields';
import { sanitizeConfig } from './config/sanitize';
import { createD1Adapter } from './db/d1';
import { ForbiddenError } from './errors';
import { createSeedContext, defineSeed } from './seed';

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({
				slug: 'legal',
				admin: { locked: true },
				access: { read: () => true, update: () => false },
				fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title', unique: true }) },
			}),
			collection({ slug: 'team', orderable: true, fields: { name: f.text({ required: true }) } }),
		],
		globals: [global({ slug: 'site', fields: { siteName: f.text({ defaultValue: 'x' }) } })],
	}),
);

let db: TestDb;
let api: Cms;
beforeAll(async () => {
	db = await createTestDb(config);
	api = createLocalApi({ config, db: createD1Adapter(config, db.d1), user: null, source: 'local' });
});
afterAll(() => db.dispose());

describe('seed context', () => {
	it('defineSeed returns the function', () => {
		const fn = async () => {};
		expect(defineSeed(fn)).toBe(fn);
	});

	it('cms calls run as the system: locked collections and denied access are bypassed', async () => {
		await expect(api.create('legal', { title: 'Nope' })).rejects.toBeInstanceOf(ForbiddenError);
		const { ctx } = createSeedContext(api);
		const doc = await ctx.cms.create('legal' as never, { title: 'Terms' } as never);
		expect(doc).toMatchObject({ title: 'Terms' });
		// update access is `() => false`, the seed still passes (options arg position handled per method)
		await ctx.cms.update('legal' as never, (doc as { id: string }).id, { title: 'Terms 2' } as never);
		await ctx.cms.delete('legal' as never, (doc as { id: string }).id);
	});

	it('ensure creates once, never overwrites, and counts', async () => {
		const { ctx, stats } = createSeedContext(api);
		const a = (await ctx.ensure('legal' as never, { where: { slug: { equals: 'privacy' } } as never, data: { title: 'Privacy' } as never })) as { id: string };
		const b = (await ctx.ensure('legal' as never, { where: { slug: { equals: 'privacy' } } as never, data: { title: 'Changed' } as never })) as unknown as { id: string; title: string };
		expect(b.id).toBe(a.id);
		expect(b.title).toBe('Privacy');
		expect(stats.legal).toEqual({ created: 1, present: 1 });
		const { docs } = await api.find('legal', { where: { slug: { equals: 'privacy' } } as never });
		expect(docs).toHaveLength(1);
	});

	it('ensure works on orderable collections (appended in order)', async () => {
		const { ctx } = createSeedContext(api);
		for (const name of ['A', 'B', 'C']) {
			await ctx.ensure('team' as never, { where: { name: { equals: name } } as never, data: { name } as never });
		}
		const { docs } = await api.find('team', { limit: 10, overrideAccess: true });
		expect(docs.map((d) => d.name)).toEqual(['A', 'B', 'C']);
	});

	it('ensureGlobal writes only the first time', async () => {
		const { ctx, stats } = createSeedContext(api);
		const first = (await ctx.ensureGlobal('site' as never, { siteName: 'kitcms dev' } as never)) as unknown as { siteName: string };
		expect(first.siteName).toBe('kitcms dev');
		const second = (await ctx.ensureGlobal('site' as never, { siteName: 'Other' } as never)) as unknown as { siteName: string };
		expect(second.siteName).toBe('kitcms dev');
		expect(stats['global:site']).toEqual({ created: 1, present: 1 });
	});
});

describe('ensureUpload', () => {
	const upConfig = sanitizeConfig(
		defineConfig({
			collections: [
				collection({ slug: 'media', upload: { mimeTypes: ['image/*'], maxFileSize: 1000 }, access: { read: () => true }, fields: { alt: f.text() } }),
			],
		}),
	);
	// 1x1 PNG
	const png = Uint8Array.from(
		atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
		(c) => c.charCodeAt(0),
	);
	let upDb: TestDb;
	let upApi: Cms;
	const objects = new Map<string, { type: string }>();
	const storage = {
		put: async (key: string, _b: unknown, o: { contentType: string }) => void objects.set(key, { type: o.contentType }),
		delete: async (key: string) => void objects.delete(key),
		get: async () => null,
		url: (key: string) => `/api/media/${key}`,
	};
	beforeAll(async () => {
		upDb = await createTestDb(upConfig);
		upApi = createLocalApi({ config: upConfig, db: createD1Adapter(upConfig, upDb.d1), storage, user: null, source: 'local' });
	});
	afterAll(() => upDb.dispose());

	it('uploads once (bytes or path), sniffs type and size, stores in R2', async () => {
		const reads: string[] = [];
		const { ctx, stats } = createSeedContext(upApi, () => {}, {
			config: upConfig,
			storage: storage as never,
			readFile: async (p) => (reads.push(p), png),
		});
		const a = (await ctx.ensureUpload('media' as never, {
			where: { alt: { equals: 'Dot' } } as never,
			file: 'static/seed/dot.png',
			data: { alt: 'Dot' } as never,
		})) as unknown as Record<string, unknown>;
		expect(a).toMatchObject({ alt: 'Dot', filename: 'dot.png', mimeType: 'image/png', width: 1, height: 1, filesize: png.byteLength });
		expect(objects.get(a.key as string)).toEqual({ type: 'image/png' });
		const b = (await ctx.ensureUpload('media' as never, {
			where: { alt: { equals: 'Dot' } } as never,
			file: { bytes: png, filename: 'other.png' },
		})) as unknown as Record<string, unknown>;
		expect(b.id).toBe(a.id);
		expect(reads).toEqual(['static/seed/dot.png']);
		expect(stats.media).toEqual({ created: 1, present: 1 });
	});

	it('enforces the collection mimeTypes and maxFileSize', async () => {
		const { ctx } = createSeedContext(upApi, () => {}, { config: upConfig, storage: storage as never });
		await expect(
			ctx.ensureUpload('media' as never, { where: { alt: { equals: 'pdf' } } as never, file: { bytes: new TextEncoder().encode('%PDF-1.4'), filename: 'a.pdf' } }),
		).rejects.toThrow(/not allowed/);
		await expect(
			ctx.ensureUpload('media' as never, { where: { alt: { equals: 'big' } } as never, file: { bytes: new Uint8Array(2000), filename: 'a.png', mimeType: 'image/png' } }),
		).rejects.toThrow();
	});

	it('upload fields stay locked for plain seed creates', async () => {
		const { ctx } = createSeedContext(upApi);
		const doc = (await ctx.cms.create('media' as never, { alt: 'x', key: 'evil/key', filename: 'f' } as never).catch((e: unknown) => e)) as Record<string, unknown>;
		expect(doc.key === 'evil/key').toBe(false);
	});
});
