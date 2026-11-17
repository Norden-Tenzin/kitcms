// Orderable + locked collections through the Local API (plan §13.2, §13.3), on Miniflare D1.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../test/d1';
import { collection, defineConfig } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';
import { ForbiddenError, NotFoundError, QueryError } from '../errors';
import { createLocalApi } from './local';
import type { Cms } from './types';

const contexts: Record<string, unknown>[] = [];

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({
				slug: 'team',
				orderable: true,
				access: { read: () => true, update: ({ req }) => (req.user?.role === 'admin' ? true : req.user ? { locked: { not_equals: true } } : false) },
				hooks: {
					beforeChange: ({ data, req }) => {
						contexts.push({ ...req.context });
						return data;
					},
				},
				fields: { name: f.text({ required: true }), locked: f.checkbox() },
			}),
			collection({ slug: 'plain', access: { read: () => true }, fields: { name: f.text() } }),
			collection({
				slug: 'legal',
				admin: { locked: true },
				access: { read: () => true, create: () => true, delete: () => true, update: () => true },
				fields: { title: f.text({ required: true }) },
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
});
afterAll(() => db.dispose());

async function names(user: KitcmsUser | null = admin): Promise<string[]> {
	const { docs } = await as(user).find('team', { limit: 100 });
	return docs.map((d) => String(d.name));
}

async function seed(): Promise<Record<string, string>> {
	const ids: Record<string, string> = {};
	for (const n of ['a', 'b', 'c', 'd']) ids[n] = ((await as(admin).create('team', { name: n })) as { id: string }).id;
	return ids;
}

describe('orderable collections', () => {
	let ids: Record<string, string>;
	beforeAll(async () => {
		ids = await seed();
	});

	it('appends on create and default-sorts by _order', async () => {
		expect(await names()).toEqual(['a', 'b', 'c', 'd']);
		const doc = await as(admin).findByID('team', ids.a!);
		expect(typeof (doc as { _order?: string })._order).toBe('string');
	});

	it('ignores _order in create/update input', async () => {
		const doc = (await as(admin).create('team', { name: 'e', _order: 'a0' } as never)) as unknown as { _order: string; id: string };
		expect(doc._order).not.toBe('a0');
		const upd = (await as(admin).update('team', doc.id, { _order: '0' } as never)) as unknown as { _order: string };
		expect(upd._order).toBe(doc._order);
		expect(await names()).toEqual(['a', 'b', 'c', 'd', 'e']);
		await as(admin).delete('team', doc.id);
	});

	it('the public update ignores extra arguments (no raw column writes)', async () => {
		const doc = (await as(admin).create('team', { name: 'x' })) as unknown as { _order: string; id: string };
		const upd = (await (as(admin).update as (...a: unknown[]) => Promise<unknown>)('team', doc.id, {}, {}, {
			_order: '0',
			createdAt: '2000-01-01T00:00:00.000Z',
		})) as { _order: string; createdAt: string };
		expect(upd._order).toBe(doc._order);
		expect(upd.createdAt).not.toBe('2000-01-01T00:00:00.000Z');
		await as(admin).delete('team', doc.id);
	});

	it('moves after / before in the middle, first and last', async () => {
		await as(admin).move('team', ids.a!, { after: ids.b! });
		expect(await names()).toEqual(['b', 'a', 'c', 'd']);
		await as(admin).move('team', ids.d!, { before: ids.b! });
		expect(await names()).toEqual(['d', 'b', 'a', 'c']);
		await as(admin).move('team', ids.d!, { after: ids.c! });
		expect(await names()).toEqual(['b', 'a', 'c', 'd']);
		await as(admin).move('team', ids.c!, { before: ids.b! });
		expect(await names()).toEqual(['c', 'b', 'a', 'd']);
		const moved = await as(admin).move('team', ids.c!, { after: ids.c === ids.d ? ids.a! : ids.d! });
		expect(moved.id).toBe(ids.c);
		expect(await names()).toEqual(['b', 'a', 'd', 'c']);
		// repeated moves in the same slot keep working
		for (let i = 0; i < 10; i++) {
			await as(admin).move('team', ids.c!, { before: ids.a! });
			await as(admin).move('team', ids.c!, { after: ids.b! });
		}
		expect(await names()).toEqual(['b', 'c', 'a', 'd']);
	});

	it('runs hooks with context.move and the update access rule', async () => {
		contexts.length = 0;
		await as(admin).move('team', ids.a!, { after: ids.d! });
		expect(contexts.at(-1)).toMatchObject({ move: true });
		await as(admin).update('team', ids.b!, { locked: true });
		const before = await names();
		await expect(as(editor).move('team', ids.b!, { after: ids.d! })).rejects.toBeInstanceOf(NotFoundError);
		expect(await names()).toEqual(before);
		await expect(as(null).move('team', ids.c!, { after: ids.d! })).rejects.toBeInstanceOf(ForbiddenError);
		await as(admin).update('team', ids.b!, { locked: false });
	});

	it('validates the target', async () => {
		const id = ids.a!;
		await expect(as(admin).move('team', id, { after: id })).rejects.toBeInstanceOf(QueryError);
		await expect(as(admin).move('team', id, {} as never)).rejects.toBeInstanceOf(QueryError);
		await expect(as(admin).move('team', id, { after: ids.b!, before: ids.c! } as never)).rejects.toBeInstanceOf(QueryError);
		await expect(as(admin).move('team', id, { after: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
		await expect(as(admin).move('team', 'nope', { after: ids.b! })).rejects.toBeInstanceOf(NotFoundError);
		await expect(as(admin).move('plain' as never, id, { after: ids.b! })).rejects.toBeInstanceOf(QueryError);
	});

	it('refuses to move relative to a document without an order key', async () => {
		const target = await as(admin).create('team', { name: 'legacy' });
		await db.d1.prepare('update team set _order = null where id = ?').bind(target.id).run();
		await expect(as(admin).move('team', ids.a!, { after: target.id })).rejects.toThrow(/no order key/);
		await as(admin).delete('team', target.id);
	});

	it('round trips: create = 2, move = 3', async () => {
		batches = 0;
		await as(admin).create('team', { name: 'rt' });
		expect(batches).toBe(2);
		batches = 0;
		await as(admin).move('team', ids.a!, { before: ids.b! });
		expect(batches).toBe(3);
	});
});

describe('locked collections', () => {
	it('denies create and delete through the Local API unless overrideAccess', async () => {
		await expect(as(admin).create('legal', { title: 'Privacy' })).rejects.toBeInstanceOf(ForbiddenError);
		const doc = await as(admin).create('legal', { title: 'Privacy' }, { overrideAccess: true });
		await expect(as(admin).delete('legal', doc.id)).rejects.toBeInstanceOf(ForbiddenError);
		expect((await as(admin).update('legal', doc.id, { title: 'Privacy policy' })).title).toBe('Privacy policy');
		await as(admin).delete('legal', doc.id, { overrideAccess: true });
	});
});
