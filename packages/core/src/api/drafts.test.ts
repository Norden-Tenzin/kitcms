// Drafts, publish, autosave and unpublish (§13.4) against Miniflare D1.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../test/d1';
import { collection, defineConfig, global } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';
import { ForbiddenError, NotFoundError, QueryError, ReferencedError, ValidationError } from '../errors';
import { createLocalApi } from './local';
import type { Cms } from './types';

let ctxSeen: Record<string, unknown>[] = [];
let n = 0;
const media = () => ({ alt: 'a', filename: 'a.png', mimeType: 'image/png', filesize: 1, key: `k/${n++}.png` });

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({ slug: 'media', upload: true, access: { read: () => true }, fields: { alt: f.text() } }),
			collection({
				slug: 'pages',
				versions: { drafts: { autosave: true }, max: 4 },
				access: { read: () => true },
				hooks: {
					beforeChange: ({ data, req }) => {
						ctxSeen.push({ ...req.context });
						return data;
					},
				},
				fields: {
					title: f.text({ required: true }),
					body: f.textarea(),
					views: f.number(),
					cover: f.upload({ relationTo: 'media' }),
					parent: f.relationship({ relationTo: 'pages' }),
					items: f.array({ fields: { label: f.text() } }),
					secret: f.text({ access: { read: ({ req }) => req.user?.role === 'admin' } }),
				},
			}),
			collection({
				slug: 'ordered',
				orderable: true,
				versions: { drafts: true },
				access: { read: () => true },
				fields: { title: f.text({ required: true }) },
			}),
			collection({
				slug: 'strict',
				versions: { drafts: true },
				access: { read: () => true },
				fields: { items: f.array({ minRows: 1, fields: { label: f.text() } }) },
			}),
			collection({
				slug: 'plain',
				access: { read: () => true },
				fields: { title: f.text() },
			}),
		],
		globals: [
			global({
				slug: 'site',
				versions: { drafts: true },
				access: { read: () => true },
				fields: {
					siteName: f.text({ required: true, defaultValue: 'My site' }),
					logo: f.upload({ relationTo: 'media' }),
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
let cms: Cms;
let anon: Cms;

beforeAll(async () => {
	db = await createTestDb(config);
	const counted = new Proxy(db.d1, {
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
	cms = as(admin);
	anon = as(null);
});
afterAll(() => db.dispose());

async function versionCount(table: string, parent: string): Promise<number> {
	const row = await db.d1.prepare(`select count(*) as n from ${table} where parent = ?`).bind(parent).first<{ n: number }>();
	return row?.n ?? 0;
}

async function latestFlags(table: string, parent: string): Promise<number> {
	const row = await db.d1
		.prepare(`select count(*) as n from ${table} where parent = ? and latest = 1`)
		.bind(parent)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

describe('public reads hide drafts', () => {
	it('find / findOne / findByID / count only see published documents', async () => {
		const draft = await cms.create('pages', { title: 'Hidden one' }, { draft: true });
		const pub = await cms.create('pages', { title: 'Visible one' });
		expect(draft._status).toBe('draft');
		expect(pub._status).toBe('published');

		const list = await anon.find('pages', { where: { title: { like: 'one' } } });
		expect(list.docs.map((d) => d.id)).toEqual([pub.id]);
		expect(list.totalDocs).toBe(1);
		expect(await anon.findByID('pages', draft.id)).toBeNull();
		expect(await anon.findByID('pages', pub.id)).toMatchObject({ title: 'Visible one', _status: 'published' });
		expect(await anon.findOne('pages', { where: { id: { equals: draft.id } } })).toBeNull();
		expect(await anon.count('pages', { where: { title: { like: 'one' } } })).toBe(1);
		// A signed-in user still gets published-only without `draft`.
		expect(await cms.findByID('pages', draft.id)).toBeNull();
		// The caller's `where` can't widen it.
		const sneaky = await anon.find('pages', { where: { or: [{ _status: { equals: 'draft' } }, { title: { like: 'one' } }] } });
		expect(sneaky.docs.map((d) => d.id)).toEqual([pub.id]);
	});

	it('`draft: true` includes unpublished documents for signed-in users', async () => {
		const found = await cms.find('pages', { draft: true, where: { title: { equals: 'Hidden one' } } });
		expect(found.docs).toHaveLength(1);
		expect(found.docs[0]!._status).toBe('draft');
		expect(await cms.count('pages', { draft: true, where: { title: { like: 'one' } } })).toBe(2);
	});

	it('`draft: true` is forbidden for anonymous callers, unless overrideAccess', async () => {
		await expect(anon.find('pages', { draft: true })).rejects.toBeInstanceOf(ForbiddenError);
		await expect(anon.findByID('pages', 'x', { draft: true })).rejects.toBeInstanceOf(ForbiddenError);
		await expect(anon.findOne('pages', { draft: true })).rejects.toBeInstanceOf(ForbiddenError);
		await expect(anon.count('pages', { draft: true })).rejects.toBeInstanceOf(ForbiddenError);
		await expect(anon.findGlobal('site', { draft: true })).rejects.toBeInstanceOf(ForbiddenError);
		await expect(anon.find('pages', { draft: true, overrideAccess: true })).resolves.toBeDefined();
	});

	it('`_status` can be filtered and sorted on', async () => {
		const drafts = await cms.find('pages', { draft: true, where: { _status: { equals: 'draft' } }, sort: '_status' });
		expect(drafts.docs.every((d) => d._status === 'draft')).toBe(true);
		expect(drafts.totalDocs).toBeGreaterThan(0);
	});

	it('collections without drafts ignore `draft`', async () => {
		const doc = await cms.create('plain', { title: 'p' }, { draft: true });
		expect(doc._status).toBeUndefined();
		expect((await anon.find('plain', {})).docs.map((d) => d.id)).toContain(doc.id);
	});
});

describe('populate', () => {
	it('relationship targets only resolve to published documents unless the read is a draft read', async () => {
		const target = await cms.create('pages', { title: 'Target' }, { draft: true });
		const live = await cms.create('pages', { title: 'Live target' });
		const a = await cms.create('pages', { title: 'A', parent: target.id });
		const b = await cms.create('pages', { title: 'B', parent: live.id });

		const pa = await anon.findByID('pages', a.id, { depth: 1 });
		expect(pa?.parent).toBe(target.id); // unresolved: stays an id
		const pb = await anon.findByID('pages', b.id, { depth: 1 });
		expect(pb?.parent).toMatchObject({ id: live.id, title: 'Live target' });

		const da = await cms.findByID('pages', a.id, { depth: 1, draft: true });
		expect(da?.parent).toMatchObject({ id: target.id, title: 'Target' });
		// A write's returned doc is populated published-only.
		const updated = await cms.update('pages', a.id, { title: 'A2' }, { depth: 1, draft: true });
		expect(updated.parent).toBe(target.id);
	});
});

describe('draft saves', () => {
	it('create as draft skips required and minRows but keeps other validation', async () => {
		const doc = await cms.create('pages', {}, { draft: true });
		expect(doc._status).toBe('draft');
		await expect(cms.create('pages', {})).rejects.toBeInstanceOf(ValidationError);
		await expect(cms.create('strict', {})).rejects.toBeInstanceOf(ValidationError);
		await expect(cms.create('strict', {}, { draft: true })).resolves.toMatchObject({ _status: 'draft' });
		await expect(cms.create('pages', { views: 'abc' as never }, { draft: true })).rejects.toBeInstanceOf(ValidationError);
		await expect(cms.update('pages', doc.id, { title: 'x' }, { autosave: true })).rejects.toBeInstanceOf(QueryError);
	});

	const full = { title: 'Full', items: [{ label: 'one' }] };

	it('a draft save on a published document leaves the published one alone', async () => {
		const pub = await cms.create('pages', { ...full, body: 'v1' });
		const saved = await cms.update('pages', pub.id, { body: 'v2 draft' }, { draft: true });
		expect(saved).toMatchObject({ _status: 'draft', body: 'v2 draft', title: 'Full' });

		expect(await anon.findByID('pages', pub.id)).toMatchObject({ body: 'v1', _status: 'published' });
		const draft = await cms.findByID('pages', pub.id, { draft: true });
		expect(draft).toMatchObject({ body: 'v2 draft', _status: 'draft', createdAt: pub.createdAt });
		expect(Date.parse(draft!.updatedAt)).toBeGreaterThan(Date.parse(pub.updatedAt));
		const list = await cms.find('pages', { draft: true, where: { id: { equals: pub.id } } });
		expect(list.docs[0]).toMatchObject({ body: 'v2 draft', _status: 'draft' });
		// Without `draft` the list is still the published state.
		expect((await cms.find('pages', { where: { id: { equals: pub.id } } })).docs[0]).toMatchObject({ body: 'v1' });
	});

	it('merges draft updates onto the latest draft, not the published row', async () => {
		const pub = await cms.create('pages', { ...full, body: 'v1', views: 1 });
		await cms.update('pages', pub.id, { body: 'draft body' }, { draft: true });
		const second = await cms.update('pages', pub.id, { views: 7 }, { draft: true });
		expect(second).toMatchObject({ body: 'draft body', views: 7 });
	});

	it('publishing publishes the latest draft merged with the new data', async () => {
		const pub = await cms.create('pages', { ...full, body: 'v1' });
		await cms.update('pages', pub.id, { body: 'draft body', title: 'Draft title' }, { draft: true });
		const published = await cms.update('pages', pub.id, { views: 3 });
		expect(published).toMatchObject({ _status: 'published', body: 'draft body', title: 'Draft title', views: 3 });
		expect(await anon.findByID('pages', pub.id)).toMatchObject({ title: 'Draft title', views: 3 });
		const draftRead = await cms.findByID('pages', pub.id, { draft: true });
		expect(draftRead).toMatchObject({ _status: 'published', title: 'Draft title' });
	});

	it('publishing requires a complete document', async () => {
		const d = await cms.create('pages', { body: 'x' }, { draft: true });
		await expect(cms.update('pages', d.id, {})).rejects.toBeInstanceOf(ValidationError);
		expect(await anon.findByID('pages', d.id)).toBeNull();
		const p = await cms.update('pages', d.id, { title: 'Now valid', items: [{ label: 'a' }] });
		expect(p._status).toBe('published');
		expect(await anon.findByID('pages', d.id)).toMatchObject({ title: 'Now valid', body: 'x' });
	});

	it('never-published documents update the main row too, and stay drafts', async () => {
		const d = await cms.create('pages', { title: 'First' }, { draft: true });
		const s = await cms.update('pages', d.id, { title: 'Second' }, { draft: true });
		expect(s).toMatchObject({ _status: 'draft', title: 'Second' });
		expect(await anon.findByID('pages', d.id)).toBeNull();
		const row = await db.d1.prepare('select title, _status from pages where id = ?').bind(d.id).first<{ title: string; _status: string }>();
		expect(row).toEqual({ title: 'Second', _status: 'draft' });
	});

	it('hooks see context.draft on draft saves only', async () => {
		ctxSeen = [];
		const d = await cms.create('pages', { title: 'ctx' }, { draft: true });
		await cms.update('pages', d.id, { title: 'ctx2', items: [{ label: 'a' }] });
		expect(ctxSeen[0]).toMatchObject({ draft: true });
		expect(ctxSeen[1]?.draft).toBeUndefined();
	});

	it('field write access applies to draft saves', async () => {
		const ed = as(editor);
		const d = await ed.create('pages', { title: 't' }, { draft: true });
		expect(d.secret).toBeUndefined();
	});
});

describe('unpublish', () => {
	it('takes a document offline, keeps its data and adds no version', async () => {
		ctxSeen = [];
		const pub = await cms.create('pages', { title: 'Offline me', items: [{ label: 'a' }], body: 'b' });
		const before = await versionCount('pages_versions', pub.id);
		const out = await cms.unpublish('pages', pub.id);
		expect(out._status).toBe('draft');
		expect(ctxSeen.at(-1)).toMatchObject({ unpublish: true });
		expect(await anon.findByID('pages', pub.id)).toBeNull();
		expect(await cms.findByID('pages', pub.id, { draft: true })).toMatchObject({ title: 'Offline me', body: 'b', _status: 'draft' });
		expect(await versionCount('pages_versions', pub.id)).toBe(before);
		// Publishing again brings it back.
		await cms.update('pages', pub.id, {});
		expect(await anon.findByID('pages', pub.id)).toMatchObject({ title: 'Offline me' });
	});

	it('keeps a newer draft visible to draft reads', async () => {
		const pub = await cms.create('pages', { title: 'T', items: [{ label: 'a' }] });
		await cms.update('pages', pub.id, { title: 'T draft' }, { draft: true });
		await cms.unpublish('pages', pub.id);
		expect(await cms.findByID('pages', pub.id, { draft: true })).toMatchObject({ title: 'T draft' });
		expect(await anon.findByID('pages', pub.id)).toBeNull();
	});

	it('needs update access and drafts', async () => {
		const pub = await cms.create('pages', { title: 'T', items: [{ label: 'a' }] });
		await expect(anon.unpublish('pages', pub.id)).rejects.toBeInstanceOf(ForbiddenError);
		const p = await cms.create('plain', { title: 'x' });
		await expect(cms.unpublish('plain', p.id)).rejects.toBeInstanceOf(QueryError);
		await expect(cms.unpublish('pages', 'nope')).rejects.toBeInstanceOf(NotFoundError);
	});

	it('move on an orderable drafts collection neither publishes nor hides a draft', async () => {
		const a = await cms.create('ordered', { title: 'a' }, { draft: true });
		const b = await cms.create('ordered', { title: 'b' });
		await cms.move('ordered', b.id, { before: a.id });
		expect((await cms.findByID('ordered', a.id, { draft: true }))?._status).toBe('draft');
		const list = await cms.find('ordered', { draft: true });
		expect(list.docs.map((d) => d.id)).toEqual([b.id, a.id]);
		expect(await anon.findByID('ordered', a.id)).toBeNull();
		expect(await anon.findByID('ordered', b.id)).not.toBeNull();
	});
});

describe('versions bookkeeping', () => {
	const full = { title: 'V', items: [{ label: 'a' }] };

	it('keeps exactly one latest version and prunes to max', async () => {
		const d = await cms.create('pages', full);
		for (let i = 0; i < 6; i++) await cms.update('pages', d.id, { views: i }, { draft: true });
		expect(await versionCount('pages_versions', d.id)).toBe(4); // max
		expect(await latestFlags('pages_versions', d.id)).toBe(1);
		const newest = await db.d1
			.prepare('select version from pages_versions where parent = ? and latest = 1')
			.bind(d.id)
			.first<{ version: string }>();
		expect(JSON.parse(newest!.version)).toMatchObject({ views: 5 });
	});

	it('autosave updates the latest autosave version in place, otherwise inserts', async () => {
		const d = await cms.create('pages', full);
		expect(await versionCount('pages_versions', d.id)).toBe(1);
		await cms.update('pages', d.id, { body: '1' }, { draft: true, autosave: true });
		expect(await versionCount('pages_versions', d.id)).toBe(2);
		await cms.update('pages', d.id, { body: '2' }, { draft: true, autosave: true });
		await cms.update('pages', d.id, { body: '3' }, { draft: true, autosave: true });
		expect(await versionCount('pages_versions', d.id)).toBe(2);
		expect(await cms.findByID('pages', d.id, { draft: true })).toMatchObject({ body: '3', _status: 'draft' });
		// A manual save adds a version, and the next autosave starts a fresh one after it.
		await cms.update('pages', d.id, { body: 'manual' }, { draft: true });
		expect(await versionCount('pages_versions', d.id)).toBe(3);
		await cms.update('pages', d.id, { body: 'auto' }, { draft: true, autosave: true });
		expect(await versionCount('pages_versions', d.id)).toBe(4);
		expect(await latestFlags('pages_versions', d.id)).toBe(1);
		// Publishing adds a non-autosave version.
		await cms.update('pages', d.id, {});
		const { docs } = await cms.findVersions('pages', d.id, { limit: 2 });
		expect(docs[0]).toMatchObject({ _status: 'published', autosave: false, latest: true });
		expect(docs[1]).toMatchObject({ _status: 'draft', autosave: true, latest: false });
	});

	it('an autosave on a never-published document updates the main row too', async () => {
		const d = await cms.create('pages', { title: 'a' }, { draft: true });
		await cms.update('pages', d.id, { title: 'b' }, { draft: true, autosave: true });
		await cms.update('pages', d.id, { title: 'c' }, { draft: true, autosave: true });
		const row = await db.d1.prepare('select title from pages where id = ?').bind(d.id).first<{ title: string }>();
		expect(row?.title).toBe('c');
		expect(await versionCount('pages_versions', d.id)).toBe(2);
	});

	it('deleting a document deletes its versions (FK cascade)', async () => {
		const d = await cms.create('pages', full);
		await cms.update('pages', d.id, { body: 'x' }, { draft: true });
		expect(await versionCount('pages_versions', d.id)).toBe(2);
		await cms.delete('pages', d.id);
		expect(await versionCount('pages_versions', d.id)).toBe(0);
	});
});

describe('refs', () => {
	it('media used only by a draft is delete-protected; publishing resets the refs', async () => {
		const m1 = await cms.create('media', media(), { overrideAccess: true });
		const m2 = await cms.create('media', media(), { overrideAccess: true });
		const page = await cms.create('pages', { title: 'R', items: [{ label: 'a' }], cover: m1.id });
		await cms.update('pages', page.id, { cover: m2.id }, { draft: true });
		// m1 is published, m2 only in the draft: both protected.
		await expect(cms.delete('media', m1.id)).rejects.toBeInstanceOf(ReferencedError);
		await expect(cms.delete('media', m2.id)).rejects.toBeInstanceOf(ReferencedError);
		await cms.update('pages', page.id, {});
		await expect(cms.delete('media', m2.id)).rejects.toBeInstanceOf(ReferencedError);
		await expect(cms.delete('media', m1.id)).resolves.toBeDefined();
	});

	it('a never-published draft protects its media too', async () => {
		const m = await cms.create('media', media(), { overrideAccess: true });
		await cms.create('pages', { title: 'D', cover: m.id }, { draft: true });
		await expect(cms.delete('media', m.id)).rejects.toBeInstanceOf(ReferencedError);
	});
});

describe('globals with drafts', () => {
	it('an unpublished global reads as its defaults without `draft`', async () => {
		expect(await anon.findGlobal('site')).toMatchObject({ siteName: 'My site', _status: 'draft' });
		const saved = await cms.updateGlobal('site', { siteName: 'Draft name' }, { draft: true });
		expect(saved).toMatchObject({ siteName: 'Draft name', _status: 'draft', id: 'site' });
		expect(await anon.findGlobal('site')).toMatchObject({ siteName: 'My site' });
		expect(await cms.findGlobal('site', { draft: true })).toMatchObject({ siteName: 'Draft name', _status: 'draft' });

		const pub = await cms.updateGlobal('site', { siteName: 'Live name' });
		expect(pub._status).toBe('published');
		expect(await anon.findGlobal('site')).toMatchObject({ siteName: 'Live name', _status: 'published' });

		await cms.updateGlobal('site', { siteName: 'Next draft' }, { draft: true });
		expect(await anon.findGlobal('site')).toMatchObject({ siteName: 'Live name' });
		expect(await cms.findGlobal('site', { draft: true })).toMatchObject({ siteName: 'Next draft', _status: 'draft' });
		expect(await cms.findGlobal('site')).toMatchObject({ siteName: 'Live name' });
	});

	it('draft logo refs protect media', async () => {
		const m = await cms.create('media', media(), { overrideAccess: true });
		await cms.updateGlobal('site', { logo: m.id }, { draft: true });
		await expect(cms.delete('media', m.id)).rejects.toBeInstanceOf(ReferencedError);
	});
});

describe('round trips', () => {
	const full = { title: 'RT', items: [{ label: 'a' }] };
	async function trips(fn: () => Promise<unknown>): Promise<number> {
		const before = batches;
		await fn();
		return batches - before;
	}

	it('stays within the budget', async () => {
		const d = await cms.create('pages', full);
		expect(await trips(() => anon.findByID('pages', d.id))).toBe(1);
		expect(await trips(() => anon.find('pages', {}))).toBe(1);
		expect(await trips(() => cms.findByID('pages', d.id, { draft: true }))).toBe(1);
		expect(await trips(() => cms.find('pages', { draft: true }))).toBe(2);
		expect(await trips(() => cms.update('pages', d.id, { body: 'x' }, { draft: true }))).toBe(2);
		expect(await trips(() => cms.update('pages', d.id, { body: 'y' }, { draft: true, autosave: true }))).toBe(2);
		expect(await trips(() => cms.update('pages', d.id, {}))).toBe(2); // publish
		expect(await trips(() => cms.create('pages', { title: 'x' }, { draft: true }))).toBe(1);
		expect(await trips(() => cms.create('pages', full))).toBe(1);
		expect(await trips(() => cms.unpublish('pages', d.id))).toBe(2);
		expect(await trips(() => cms.findGlobal('site', { draft: true }))).toBe(1);
		expect(await trips(() => cms.updateGlobal('site', { siteName: 's' }, { draft: true }))).toBe(2);
		expect(await trips(() => cms.create('ordered', { title: 'o' }))).toBe(2);
	});
});
