// Pipeline integration tests: Local API → access → hooks → validate → D1 (Miniflare) → hooks.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../test/d1';
import { block, collection, defineConfig } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';
import { ForbiddenError, NotFoundError, QueryError, ReferencedError, ValidationError } from '../errors';
import { createLocalApi } from './local';
import type { Cms } from './types';

const calls: string[] = [];
let n = 0;
const media = (alt: string) => ({
	alt,
	filename: 'a.png',
	mimeType: 'image/png',
	filesize: 1,
	key: `k/${n++}.png`,
});

const Hero = block({
	slug: 'hero',
	fields: { heading: f.text({ required: true }), image: f.upload({ relationTo: 'media' }) },
});

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({
				slug: 'media',
				upload: true,
				access: { read: () => true },
				fields: { alt: f.text() },
			}),
			collection({
				slug: 'pages',
				access: {
					read: ({ req }) => (req.user ? true : { status: { equals: 'published' } }),
					update: ({ req }) =>
						req.user?.role === 'admin' ? true : req.user ? { author: { equals: req.user.id } } : false,
				},
				hooks: {
					beforeChange: ({ data, operation }) => {
						calls.push(`beforeChange:${operation}`);
						return { ...data, views: (data.views ?? 0) + 0 };
					},
					afterChange: ({ operation }) => {
						calls.push(`afterChange:${operation}`);
					},
					afterRead: ({ doc }) => ({ ...doc, computed: `read:${doc.title}` }),
				},
				fields: {
					title: f.text({ required: true, validate: (v) => (v === 'forbidden' ? 'Not that title' : true) }),
					slug: f.slug({ from: 'title', unique: true }),
					status: f.select({ options: ['draft', 'published'], defaultValue: 'draft' }),
					views: f.number(),
					featured: f.checkbox(),
					author: f.text(),
					secret: f.text({ access: { read: ({ req }) => req.user?.role === 'admin' } }),
					subtitle: f.text({ admin: { condition: (data) => data.status === 'published' }, required: true }),
					cover: f.upload({ relationTo: 'media' }),
					related: f.relationship({ relationTo: 'pages', hasMany: true }),
					sections: f.blocks({ blocks: [Hero] }),
					publishedAt: f.date(),
				},
			}),
		],
	}),
);

const admin: KitcmsUser = { id: 'u-admin', email: 'a@x.io', name: 'A', role: 'admin', collection: 'users' };
const editor: KitcmsUser = { id: 'u-ed', email: 'e@x.io', name: 'E', role: 'editor', collection: 'users' };

let db: TestDb;
let batches = 0;
let as: (user: KitcmsUser | null) => Cms;

beforeAll(async () => {
	db = await createTestDb(config);
	const d1 = db.d1;
	const counted = new Proxy(d1, {
		get(target, prop, receiver) {
			const v = Reflect.get(target, prop, receiver) as unknown;
			if (prop === 'batch' && typeof v === 'function') {
				return (...args: unknown[]) => {
					batches++;
					return (v as (...a: unknown[]) => unknown).apply(target, args);
				};
			}
			return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
		},
	});
	const adapter = createD1Adapter(config, counted);
	as = (user) => createLocalApi({ config, db: adapter, user, source: 'local' });
});
afterAll(() => db.dispose());

describe('create', () => {
	it('applies defaults, slugs, hooks, ids and returns the read view', async () => {
		calls.length = 0;
		const doc = await as(admin).create('pages', { title: 'Hello World', author: 'u-ed', secret: 's' });
		expect(doc.id).toMatch(/^[0-9A-Z]{26}$/);
		expect(doc).toMatchObject({
			title: 'Hello World',
			slug: 'hello-world',
			status: 'draft',
			featured: false,
			related: [],
			sections: [],
			secret: 's',
			computed: 'read:Hello World',
		});
		expect(typeof doc.createdAt).toBe('string');
		expect(calls).toEqual(['beforeChange:create', 'afterChange:create']);
	});

	it('generates block ids and strips unknown keys', async () => {
		const doc = await as(admin).create('pages', {
			title: 'Blocks',
			sections: [{ blockType: 'hero', heading: 'H', nope: 1 }],
			bogus: 'x',
			id: 'chosen-id',
		} as never);
		const s = (doc.sections as Record<string, unknown>[])[0]!;
		expect(s.id).toMatch(/^[0-9A-Z]{26}$/);
		expect(s).not.toHaveProperty('nope');
		expect(doc).not.toHaveProperty('bogus');
		expect(doc.id).not.toBe('chosen-id');
	});

	it('validates with collected errors (built-in + custom, nested paths)', async () => {
		const err = await as(admin)
			.create('pages', { title: 'forbidden', views: 'x', sections: [{ blockType: 'hero' }] } as never)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ValidationError);
		const paths = (err as ValidationError).errors.map((e) => e.path).sort();
		expect(paths).toEqual(['sections.0.heading', 'title', 'views']);
	});

	it('skips validation of fields hidden by admin.condition', async () => {
		await expect(as(admin).create('pages', { title: 'Draft no subtitle' })).resolves.toBeTruthy();
		await expect(as(admin).create('pages', { title: 'Pub', status: 'published' })).rejects.toBeInstanceOf(
			ValidationError,
		);
	});

	it('maps UNIQUE violations to a field error', async () => {
		const err = await as(admin).create('pages', { title: 'Hello World' }).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ValidationError);
		expect((err as ValidationError).errors).toEqual([{ path: 'slug', message: 'Must be unique' }]);
	});

	it('denies anonymous creates (default: signed-in only)', async () => {
		await expect(as(null).create('pages', { title: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
	});

	it('costs one D1 round trip', async () => {
		batches = 0;
		await as(admin).create('pages', { title: 'Round trip' });
		expect(batches).toBe(1);
	});
});

describe('read', () => {
	it('anonymous reads are filtered by the access where, and field access applies', async () => {
		const pub = await as(admin).create('pages', {
			title: 'Public page',
			status: 'published',
			subtitle: 'sub',
			secret: 'top',
		});
		const anon = await as(null).find('pages', { limit: 100 });
		expect(anon.docs.every((d) => d.status === 'published')).toBe(true);
		const mine = anon.docs.find((d) => d.id === pub.id)!;
		expect(mine).not.toHaveProperty('secret');
		expect(await as(null).findByID('pages', (await as(admin).findOne('pages', { where: { status: { equals: 'draft' } } }))!.id)).toBeNull();
	});

	it("a caller's `or` can't widen the access filter", async () => {
		const { docs } = await as(null).find('pages', {
			where: { or: [{ status: { equals: 'draft' } }, { title: { exists: true } }] },
			limit: 100,
		});
		expect(docs.length).toBeGreaterThan(0);
		expect(docs.every((d) => d.status === 'published')).toBe(true);
	});

	it('paginates with find + count in one round trip', async () => {
		batches = 0;
		const res = await as(admin).find('pages', { limit: 2, page: 1, sort: 'title' });
		expect(batches).toBe(1);
		expect(res.docs).toHaveLength(2);
		expect(res.totalDocs).toBeGreaterThan(2);
		expect(res.hasNextPage).toBe(true);
		expect(String(res.docs[0]!.title) <= String(res.docs[1]!.title)).toBe(true);
	});

	it('refuses filtering or sorting on fields the caller cannot read (no where-oracle)', async () => {
		await expect(as(editor).find('pages', { where: { secret: { equals: 'top' } } })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		await expect(
			as(editor).find('pages', { where: { or: [{ title: { exists: true } }, { secret: { exists: true } }] } }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(as(editor).find('pages', { sort: '-secret' })).rejects.toBeInstanceOf(ForbiddenError);
		await expect(as(null).count('pages', { where: { secret: { exists: true } } })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		await expect(as(admin).find('pages', { where: { secret: { equals: 'top' } } })).resolves.toBeTruthy();
	});

	it('rejects bad queries from untyped callers', async () => {
		await expect(as(admin).find('pages', { where: { nope: { equals: 1 } } } as never)).rejects.toBeInstanceOf(
			QueryError,
		);
		await expect(as(admin).find('pages', { limit: -1 })).rejects.toBeInstanceOf(QueryError);
		await expect(as(admin).find('nope' as never)).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('depth', () => {
	it('populates relationships in JSON and columns, ≤ 1 extra round trip per level', async () => {
		const img = await as(admin).create('media', media('pic'), { overrideAccess: true });
		const other = await as(admin).create('pages', { title: 'Other' });
		const page = await as(admin).create('pages', {
			title: 'With rels',
			cover: img.id,
			related: [other.id, 'missing-id'],
			sections: [{ blockType: 'hero', heading: 'H', image: img.id }],
		});
		batches = 0;
		const p = (await as(admin).findByID('pages', page.id, { depth: 1 }))!;
		expect(batches).toBe(2);
		expect((p.cover as { alt: string }).alt).toBe('pic');
		expect((p.related as unknown[])[0]).toMatchObject({ id: other.id, title: 'Other' });
		expect((p.related as unknown[])[1]).toBe('missing-id');
		expect(((p.sections as { image: { id: string } }[])[0]!.image).id).toBe(img.id);

		const p0 = (await as(admin).findByID('pages', page.id))!;
		expect(p0.cover).toBe(img.id);
	});

	it('filters on hasMany through _refs', async () => {
		const target = await as(admin).create('pages', { title: 'Target' });
		const a = await as(admin).create('pages', { title: 'Links target', related: [target.id] });
		const { docs } = await as(admin).find('pages', { where: { related: { contains: target.id } } });
		expect(docs.map((d) => d.id)).toEqual([a.id]);
	});
});

describe('update', () => {
	it('merges partial data, runs hooks, and enforces where-access', async () => {
		const own = await as(admin).create('pages', { title: 'Editor owned', author: editor.id });
		const notOwn = await as(admin).create('pages', { title: 'Not owned', author: 'someone' });
		calls.length = 0;
		const updated = await as(editor).update('pages', own.id, { views: 5 });
		expect(updated).toMatchObject({ title: 'Editor owned', views: 5, slug: 'editor-owned' });
		expect(updated.updatedAt > own.updatedAt).toBe(true);
		expect(calls).toEqual(['beforeChange:update', 'afterChange:update']);
		await expect(as(editor).update('pages', notOwn.id, { views: 5 })).rejects.toBeInstanceOf(NotFoundError);
		await expect(as(null).update('pages', own.id, { views: 1 })).rejects.toBeInstanceOf(ForbiddenError);
	});

	it('costs two D1 round trips', async () => {
		const p = await as(admin).create('pages', { title: 'Two trips' });
		batches = 0;
		await as(admin).update('pages', p.id, { views: 1 });
		expect(batches).toBe(2);
	});

	it('keeps _refs in sync', async () => {
		const t = await as(admin).create('pages', { title: 'Ref target' });
		const p = await as(admin).create('pages', { title: 'Ref source', related: [t.id] });
		await expect(as(admin).delete('pages', t.id)).rejects.toBeInstanceOf(ReferencedError);
		await as(admin).update('pages', p.id, { related: [] });
		await expect(as(admin).delete('pages', t.id)).resolves.toMatchObject({ id: t.id });
	});
});

describe('delete', () => {
	it('blocks deleting referenced documents and reports where they are used', async () => {
		const img = await as(admin).create('media', media('in use'), { overrideAccess: true });
		const p = await as(admin).create('pages', { title: 'Uses image', sections: [{ blockType: 'hero', heading: 'x', image: img.id }] });
		const err = await as(admin).delete('media', img.id).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ReferencedError);
		expect((err as ReferencedError).references).toEqual([{ collection: 'pages', id: p.id, path: 'sections.0.image' }]);
		await as(admin).delete('pages', p.id);
		await expect(as(admin).delete('media', img.id)).resolves.toBeTruthy();
		expect(await as(admin).findByID('media', img.id)).toBeNull();
	});

	it('denies by default for anonymous users', async () => {
		const p = await as(admin).create('pages', { title: 'Delete me' });
		await expect(as(null).delete('pages', p.id)).rejects.toBeInstanceOf(ForbiddenError);
		await expect(as(admin).delete('pages', 'nope')).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('upload built-ins', () => {
	it('cannot be set through the Local API without the upload endpoint', async () => {
		const err = await as(admin)
			.create('media', { ...media('x'), key: 'forged' } as never)
			.catch((e: unknown) => e);
		// The forged values are dropped by field access, so the required built-ins are missing.
		expect(err).toBeInstanceOf(ValidationError);
		expect((err as ValidationError).errors.map((e) => e.path)).toContain('key');
	});
});
