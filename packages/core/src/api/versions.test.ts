// Version history, restore and version access (§13.4) against Miniflare D1.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../test/d1';
import { collection, defineConfig, global } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';
import { ForbiddenError, NotFoundError, QueryError } from '../errors';
import { createLocalApi } from './local';
import type { Cms } from './types';

const config = sanitizeConfig(
	defineConfig({
		collections: [
			// History only (no drafts).
			collection({
				slug: 'posts',
				versions: { max: 3 },
				access: {
					read: () => true,
					update: ({ req }) =>
						req.user?.role === 'admin' ? true : req.user ? { author: { equals: req.user.id } } : false,
				},
				fields: {
					title: f.text({ required: true }),
					author: f.text(),
					secret: f.text({ access: { read: ({ req }) => req.user?.role === 'admin' } }),
				},
			}),
			collection({
				slug: 'notes',
				versions: { drafts: true },
				access: { read: ({ req }) => (req.user ? true : { author: { equals: 'nobody' } }) },
				fields: { title: f.text({ required: true }), author: f.text() },
			}),
			collection({ slug: 'plain', access: { read: () => true }, fields: { title: f.text() } }),
		],
		globals: [
			global({
				slug: 'site',
				versions: { drafts: true },
				access: { read: () => true },
				fields: { siteName: f.text({ required: true }) },
			}),
			global({ slug: 'footer', versions: true, access: { read: () => true }, fields: { text: f.text() } }),
			global({ slug: 'bare', access: { read: () => true }, fields: { text: f.text() } }),
		],
	}),
);

const admin: KitcmsUser = { id: 'u-admin', email: 'a@x.io', name: 'A', role: 'admin', collection: 'users' };
const editor: KitcmsUser = { id: 'u-ed', email: 'e@x.io', name: 'E', role: 'editor', collection: 'users' };

let db: TestDb;
let as: (user: KitcmsUser | null) => Cms;
let cms: Cms;

beforeAll(async () => {
	db = await createTestDb(config);
	const adapter = createD1Adapter(config, db.d1);
	as = (user) => createLocalApi({ config, db: adapter, user, source: 'local' });
	cms = as(admin);
});
afterAll(() => db.dispose());

describe('history without drafts', () => {
	it('every create and update adds a version, newest first, no _status', async () => {
		const p = await cms.create('posts', { title: 'v1', author: editor.id });
		await cms.update('posts', p.id, { title: 'v2' });
		const page = await cms.findVersions('posts', p.id);
		expect(page.totalDocs).toBe(2);
		expect(page.docs.map((v) => v.version.title)).toEqual(['v2', 'v1']);
		expect(page.docs[0]).toMatchObject({ parent: p.id, latest: true, autosave: false });
		expect(page.docs[1]!.latest).toBe(false);
		expect(page.docs[0]!._status).toBeUndefined();
		expect(page.docs[0]!.version).not.toHaveProperty('id');
		expect(page.docs[0]!.version).not.toHaveProperty('updatedAt');
		expect(p._status).toBeUndefined();
	});

	it('prunes beyond max and paginates (limit capped at 100)', async () => {
		const p = await cms.create('posts', { title: 't0' });
		for (let i = 1; i <= 5; i++) await cms.update('posts', p.id, { title: `t${i}` });
		const all = await cms.findVersions('posts', p.id, { limit: 1000 });
		expect(all.limit).toBe(100);
		expect(all.totalDocs).toBe(3);
		expect(all.docs.map((v) => v.version.title)).toEqual(['t5', 't4', 't3']);
		const page2 = await cms.findVersions('posts', p.id, { limit: 2, page: 2 });
		expect(page2.docs.map((v) => v.version.title)).toEqual(['t3']);
		expect(page2.hasPrevPage).toBe(true);
	});

	it('findVersionByID and restoreVersion (an update with the snapshot)', async () => {
		const p = await cms.create('posts', { title: 'one' });
		await cms.update('posts', p.id, { title: 'two' });
		const [, first] = (await cms.findVersions('posts', p.id)).docs;
		expect(await cms.findVersionByID('posts', first!.id)).toMatchObject({ id: first!.id, version: { title: 'one' } });
		expect(await cms.findVersionByID('posts', 'nope')).toBeNull();
		const restored = await cms.restoreVersion('posts', first!.id);
		expect(restored.title).toBe('one');
		expect((await cms.findVersions('posts', p.id)).docs[0]!.version.title).toBe('one');
	});

	it('deleting the document deletes its history', async () => {
		const p = await cms.create('posts', { title: 'gone' });
		await cms.delete('posts', p.id);
		const row = await db.d1.prepare('select count(*) as n from posts_versions where parent = ?').bind(p.id).first<{ n: number }>();
		expect(row?.n).toBe(0);
	});

	it('QueryError without versions', async () => {
		const p = await cms.create('plain', { title: 'x' });
		await expect(cms.findVersions('plain', p.id)).rejects.toBeInstanceOf(QueryError);
		await expect(cms.restoreVersion('plain', 'x')).rejects.toBeInstanceOf(QueryError);
	});
});

describe('restore with drafts', () => {
	it('restore as draft leaves the published document; restore without draft publishes', async () => {
		const n = await cms.create('notes', { title: 'first' });
		await cms.update('notes', n.id, { title: 'second' });
		const versions = (await cms.findVersions('notes', n.id)).docs;
		const first = versions.find((v) => v.version.title === 'first')!;

		const draft = await cms.restoreVersion('notes', first.id, { draft: true });
		expect(draft).toMatchObject({ title: 'first', _status: 'draft' });
		expect(await cms.findByID('notes', n.id)).toMatchObject({ title: 'second' });
		expect(await cms.findByID('notes', n.id, { draft: true })).toMatchObject({ title: 'first', _status: 'draft' });

		const published = await cms.restoreVersion('notes', first.id);
		expect(published).toMatchObject({ title: 'first', _status: 'published' });
		expect(await cms.findByID('notes', n.id)).toMatchObject({ title: 'first' });
		const latest = (await cms.findVersions('notes', n.id)).docs[0]!;
		expect(latest).toMatchObject({ _status: 'published', latest: true });
	});

	it('version snapshots include drafts', async () => {
		const n = await cms.create('notes', { title: 'a' }, { draft: true });
		const { docs } = await cms.findVersions('notes', n.id);
		expect(docs).toHaveLength(1);
		expect(docs[0]).toMatchObject({ _status: 'draft', latest: true });
	});
});

describe('version access', () => {
	it('needs read AND update access, with the parent matching both', async () => {
		const mine = await cms.create('posts', { title: 'mine', author: editor.id, secret: 's3' });
		const theirs = await cms.create('posts', { title: 'theirs', author: 'someone' });
		const ed = as(editor);
		expect((await ed.findVersions('posts', mine.id)).docs).toHaveLength(1);
		await expect(ed.findVersions('posts', theirs.id)).rejects.toBeInstanceOf(NotFoundError);
		await expect(as(null).findVersions('posts', mine.id)).rejects.toBeInstanceOf(ForbiddenError);

		const [mv] = (await cms.findVersions('posts', mine.id)).docs;
		const [tv] = (await cms.findVersions('posts', theirs.id)).docs;
		expect(await ed.findVersionByID('posts', mv!.id)).not.toBeNull();
		expect(await ed.findVersionByID('posts', tv!.id)).toBeNull();
		await expect(as(null).findVersionByID('posts', mv!.id)).rejects.toBeInstanceOf(ForbiddenError);
		await expect(ed.restoreVersion('posts', tv!.id)).rejects.toBeInstanceOf(NotFoundError);
		await expect(ed.restoreVersion('posts', mv!.id)).resolves.toMatchObject({ title: 'mine' });
	});

	it('read access alone is not enough', async () => {
		const n = await cms.create('notes', { title: 'x' });
		// `notes` update defaults to signed-in users; an anonymous caller fails both.
		await expect(as(null).findVersions('notes', n.id)).rejects.toBeInstanceOf(ForbiddenError);
	});

	it('filters snapshots through field read access', async () => {
		const p = await cms.create('posts', { title: 'f', author: editor.id, secret: 'hush' });
		const asAdmin = (await cms.findVersions('posts', p.id)).docs[0]!;
		expect(asAdmin.version).toMatchObject({ secret: 'hush' });
		const asEditor = (await as(editor).findVersions('posts', p.id)).docs[0]!;
		expect(asEditor.version).not.toHaveProperty('secret');
		expect(asEditor.version).toMatchObject({ title: 'f' });
		const one = await as(editor).findVersionByID('posts', asAdmin.id);
		expect(one!.version).not.toHaveProperty('secret');
		// Restoring as the editor doesn't wipe the field they can't read.
		await as(editor).restoreVersion('posts', asAdmin.id);
		expect((await cms.findByID('posts', p.id))?.secret).toBe('hush');
	});
});

describe('globals', () => {
	it('lists and restores global versions', async () => {
		await cms.updateGlobal('site', { siteName: 'one' });
		await cms.updateGlobal('site', { siteName: 'two' }, { draft: true });
		const { docs } = await cms.findGlobalVersions('site');
		expect(docs.map((v) => v.version.siteName)).toEqual(['two', 'one']);
		expect(docs[0]).toMatchObject({ parent: 'site', _status: 'draft', latest: true });

		const restored = await cms.restoreGlobalVersion('site', docs[1]!.id, { draft: true });
		expect(restored).toMatchObject({ siteName: 'one', _status: 'draft' });
		expect(await as(null).findGlobal('site')).toMatchObject({ siteName: 'one', _status: 'published' });
		const pub = await cms.restoreGlobalVersion('site', docs[1]!.id);
		expect(pub._status).toBe('published');
	});

	it('history-only globals and access', async () => {
		await cms.updateGlobal('footer', { text: 'a' });
		await cms.updateGlobal('footer', { text: 'b' });
		expect((await cms.findGlobalVersions('footer')).totalDocs).toBe(2);
		await expect(as(null).findGlobalVersions('footer')).rejects.toBeInstanceOf(ForbiddenError);
		await expect(cms.findGlobalVersions('bare')).rejects.toBeInstanceOf(QueryError);
		await expect(cms.restoreGlobalVersion('footer', 'nope')).rejects.toBeInstanceOf(NotFoundError);
	});
});
