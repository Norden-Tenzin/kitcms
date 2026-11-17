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
