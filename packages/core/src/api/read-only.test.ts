// A read-only deployment (`KITCMS_READ_ONLY`, e.g. a paused site): every write is refused, whoever
// asks and however (overrideAccess, hooks); reads keep working. Security-relevant.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../test/d1';
import { collection, defineConfig, global } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';
import { ForbiddenError, ReadOnlyError } from '../errors';
import { isReadOnly } from '../runtime';
import { createLocalApi } from './local';

const admin: KitcmsUser = { id: 'u1', email: 'a@x.io', name: 'A', role: 'admin', collection: 'users' };
let hookWrite: Promise<unknown> | null = null;

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({
				slug: 'posts',
				orderable: true,
				versions: { drafts: true },
				access: { read: () => true },
				fields: { title: f.text() },
				hooks: {
					// A hook that tries to write through req.cms on read: it must be refused too.
					afterRead: [
						({ req, doc }) => {
							if (req.source !== 'admin') return doc;
							hookWrite = req.cms.create('posts', { title: 'from a hook' }, { overrideAccess: true });
							hookWrite.catch(() => {});
							return doc;
						},
					],
				},
			}),
		],
		globals: [global({ slug: 'site', access: { read: () => true }, fields: { name: f.text() } })],
	}),
);

let tdb: TestDb;
let id: string;
beforeAll(async () => {
	tdb = await createTestDb(config);
	const writable = createLocalApi({ config, db: createD1Adapter(config, tdb.d1), user: admin, source: 'local' });
	id = ((await writable.create('posts', { title: 'Hello' }, { overrideAccess: true })) as { id: string }).id;
	await writable.updateGlobal('site', { name: 'Site' }, { overrideAccess: true });
});
afterAll(() => tdb.dispose());

const ro = () => createLocalApi({ config, db: createD1Adapter(config, tdb.d1), user: admin, source: 'admin', readOnly: true });

describe('read-only Local API', () => {
	it('reads work', async () => {
		const cms = ro();
		expect((await cms.findByID('posts', id, { overrideAccess: true }))?.title).toBe('Hello');
		expect((await cms.findGlobal('site', { overrideAccess: true })).name).toBe('Site');
		expect(await cms.count('posts', { overrideAccess: true })).toBe(1);
	});

	it('every write is refused, overrideAccess included', async () => {
		const cms = ro();
		const writes: [string, () => Promise<unknown>][] = [
			['create', () => cms.create('posts', { title: 'x' }, { overrideAccess: true })],
			['update', () => cms.update('posts', id, { title: 'x' }, { overrideAccess: true })],
			['delete', () => cms.delete('posts', id, { overrideAccess: true })],
			['move', () => cms.move('posts', id, { before: null } as never, { overrideAccess: true })],
			['unpublish', () => cms.unpublish('posts', id, { overrideAccess: true })],
			['restoreVersion', () => cms.restoreVersion('posts', 'v1', { overrideAccess: true })],
			['updateGlobal', () => cms.updateGlobal('site', { name: 'x' }, { overrideAccess: true })],
			['restoreGlobalVersion', () => cms.restoreGlobalVersion('site', 'v1', { overrideAccess: true })],
		];
		for (const [name, run] of writes) {
			const err = await run().then(
				() => null,
				(e: unknown) => e,
			);
			expect(err, name).toBeInstanceOf(ReadOnlyError);
			expect(err, name).toBeInstanceOf(ForbiddenError);
		}
		// Nothing changed.
		const plain = createLocalApi({ config, db: createD1Adapter(config, tdb.d1), user: admin, source: 'local' });
		expect((await plain.findByID('posts', id, { overrideAccess: true }))?.title).toBe('Hello');
		expect(await plain.count('posts', { overrideAccess: true })).toBe(1);
	});

	it('hooks get the same read-only Local API', async () => {
		hookWrite = null;
		await ro().findByID('posts', id, { overrideAccess: true });
		expect(hookWrite).not.toBeNull();
		await expect(hookWrite).rejects.toBeInstanceOf(ReadOnlyError);
	});
});

describe('isReadOnly', () => {
	it('reads KITCMS_READ_ONLY', () => {
		expect(isReadOnly({})).toBe(false);
		expect(isReadOnly({ KITCMS_READ_ONLY: '0' })).toBe(false);
		expect(isReadOnly({ KITCMS_READ_ONLY: '' })).toBe(false);
		expect(isReadOnly({ KITCMS_READ_ONLY: '1' })).toBe(true);
		expect(isReadOnly({ KITCMS_READ_ONLY: 'true' })).toBe(true);
		expect(isReadOnly({ KITCMS_READ_ONLY: true })).toBe(true);
	});
});
