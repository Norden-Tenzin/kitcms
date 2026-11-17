import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '../../test/d1';
import { collection, defineConfig } from '../config/collection';
import { fields as f } from '../config/fields';
import { sanitizeConfig } from '../config/sanitize';
import { QueryError, ValidationError } from '../errors';
import type { DbAdapter, Row } from './adapter';
import { createD1Adapter } from './d1';

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({
				slug: 'pages',
				fields: {
					title: f.text(),
					slug: f.slug({ unique: true }),
					views: f.number(),
					featured: f.checkbox(),
					publishedAt: f.date(),
					meta: f.json(),
					seo: f.group({ fields: { title: f.text() } }),
					related: f.relationship({ relationTo: 'pages', hasMany: true }),
				},
			} as never),
		],
	}),
);

const T0 = '2024-01-01T00:00:00.000Z';
const doc = (id: string, extra: Record<string, unknown> = {}): Row => ({
	id,
	createdAt: T0,
	updatedAt: T0,
	...extra,
});

describe('D1 adapter', () => {
	let tdb: TestDb;
	let db: DbAdapter;
	let batchSpy: ReturnType<typeof vi.fn>;

	beforeAll(async () => {
		tdb = await createTestDb(config);
		// Count D1 round trips: every `batch` call is one.
		batchSpy = vi.fn((stmts: D1PreparedStatement[]) => tdb.d1.batch(stmts));
		const counted = {
			prepare: (q: string) => tdb.d1.prepare(q),
			batch: batchSpy,
			exec: (q: string) => tdb.d1.exec(q),
		} as unknown as D1Database;
		db = createD1Adapter(config, counted);
	});
	afterAll(() => tdb.dispose());
	beforeEach(async () => {
		await tdb.d1.prepare('delete from pages').run();
		await tdb.d1.prepare('delete from _refs').run();
		batchSpy.mockClear();
	});

	it('round-trips a document with conversions', async () => {
		const input = doc('a', {
			title: 'Hello',
			slug: 'hello',
			views: 1.5,
			featured: true,
			publishedAt: '2024-05-05T10:00:00.000Z',
			meta: { a: [1, { b: null }] },
			seo: { title: 'SEO' },
			related: ['x', 'y'],
			notAColumn: 'dropped',
		});
		const stored = await db.run(db.insert('pages', input));
		const expected = { ...input };
		delete expected.notAColumn;
		expect(stored).toEqual(expected);
		const [read] = await db.run(db.select({ collection: 'pages' }));
		expect(read).toEqual(expected);
		const raw = await tdb.d1.prepare('select createdAt, publishedAt, featured, meta from pages').first();
		expect(raw).toEqual({
			createdAt: Date.parse(T0),
			publishedAt: Date.parse('2024-05-05T10:00:00.000Z'),
			featured: 1,
			meta: '{"a":[1,{"b":null}]}',
		});
	});

	it('keeps nulls and defaults', async () => {
		const stored = await db.run(db.insert('pages', doc('a', { title: null })));
		expect(stored).toMatchObject({ id: 'a', title: null, publishedAt: null, meta: null, featured: false });
	});

	it('update returns the stored row and converts partial values', async () => {
		await db.run(db.insert('pages', doc('a', { title: 'one', views: 1 })));
		const updated = await db.run(
			db.update('pages', 'a', { title: 'two', updatedAt: '2024-02-02T00:00:00.000Z', publishedAt: '2024-03-03T00:00:00.000Z', bogus: 1 } as never),
		);
		expect(updated).toMatchObject({
			id: 'a',
			title: 'two',
			views: 1,
			createdAt: T0,
			updatedAt: '2024-02-02T00:00:00.000Z',
			publishedAt: '2024-03-03T00:00:00.000Z',
		});
		expect(updated).not.toHaveProperty('bogus');
	});

	it('update ignores id in values and with no real values returns the row', async () => {
		await db.run(db.insert('pages', doc('a', { title: 'one' })));
		expect(await db.run(db.update('pages', 'a', { id: 'zzz', bogus: 1 } as never))).toMatchObject({ id: 'a', title: 'one' });
		expect(await db.run(db.update('pages', 'nope', {} as never))).toBeNull();
	});

	it('update / delete with a non-matching where or id return null and change nothing', async () => {
		await db.run(db.insert('pages', doc('a', { title: 'one', views: 1 })));
		expect(await db.run(db.update('pages', 'a', { title: 'x' }, { views: { greater_than: 5 } }))).toBeNull();
		expect(await db.run(db.update('pages', 'missing', { title: 'x' }))).toBeNull();
		expect(await db.run(db.delete('pages', 'a', { views: { greater_than: 5 } }))).toBeNull();
		expect(await db.run(db.delete('pages', 'missing'))).toBeNull();
		expect(await db.run(db.count({ collection: 'pages' }))).toBe(1);
		expect(await db.run(db.update('pages', 'a', { title: 'ok' }, { views: { equals: 1 } }))).toMatchObject({ title: 'ok' });
		expect(await db.run(db.delete('pages', 'a', { views: { equals: 1 } }))).toMatchObject({ id: 'a' });
		expect(await db.run(db.count({ collection: 'pages' }))).toBe(0);
	});

	describe('select', () => {
		beforeEach(async () => {
			for (const [id, title, views] of [
				['c', 'b', 2],
				['a', 'b', 1],
				['d', 'a', 2],
				['b', 'c', 3],
			] as const) {
				await db.run(db.insert('pages', doc(id, { title, views })));
			}
		});
		const idsOf = async (args: Partial<Parameters<DbAdapter['select']>[0]>) =>
			(await db.run(db.select({ collection: 'pages', ...args }))).map((r) => r.id);

		it('sorts with an id tie-break in the direction of the last key', async () => {
			expect(await idsOf({ sort: ['title'] })).toEqual(['d', 'a', 'c', 'b']);
			expect(await idsOf({ sort: ['-title'] })).toEqual(['b', 'c', 'a', 'd']);
			expect(await idsOf({ sort: ['-views', 'title'] })).toEqual(['b', 'd', 'c', 'a']);
			expect(await idsOf({ sort: ['title', '-views'] })).toEqual(['d', 'c', 'a', 'b']);
			expect(await idsOf({ sort: ['-createdAt'] })).toEqual(['d', 'c', 'b', 'a']);
			expect(await idsOf({})).toEqual(['a', 'b', 'c', 'd']);
		});

		it('paginates stably', async () => {
			const sort = ['title'];
			expect(await idsOf({ sort, limit: 2 })).toEqual(['d', 'a']);
			expect(await idsOf({ sort, limit: 2, offset: 2 })).toEqual(['c', 'b']);
			expect(await idsOf({ sort, limit: 2, offset: 4 })).toEqual([]);
			expect(await idsOf({ sort, offset: 3 })).toEqual(['b']);
		});

		it('rejects unsortable and unknown keys', () => {
			for (const key of ['meta', 'seo', 'related', 'nope', '-nope', 'title; drop table pages']) {
				expect(() => db.select({ collection: 'pages', sort: [key] })).toThrow(QueryError);
			}
		});

		it('throws QueryError for an unknown collection or bad where when building', () => {
			expect(() => db.select({ collection: 'nope' })).toThrow(QueryError);
			expect(() => db.select({ collection: 'pages', where: { nope: { equals: 1 } } })).toThrow(QueryError);
		});

		it('counts with a where', async () => {
			expect(await db.run(db.count({ collection: 'pages' }))).toBe(4);
			expect(await db.run(db.count({ collection: 'pages', where: { title: { equals: 'b' } } }))).toBe(2);
		});
	});

	describe('selectByIds', () => {
		it('chunks more than 90 ids', async () => {
			const all = Array.from({ length: 200 }, (_, i) => `id${String(i).padStart(3, '0')}`);
			await tdb.d1.batch(
				all.map((id) =>
					tdb.d1.prepare('insert into pages (id, createdAt, updatedAt, views) values (?, 1, 1, ?)').bind(id, 1),
				),
			);
			batchSpy.mockClear();
			const rows = await db.run(db.selectByIds('pages', [...all, 'missing', all[0]!]));
			expect(rows).toHaveLength(200);
			expect(new Set(rows.map((r) => r.id))).toEqual(new Set(all));
			expect(batchSpy).toHaveBeenCalledTimes(1);
			const filtered = await db.run(db.selectByIds('pages', all, { id: { in: ['id005', 'id150', 'x'] } }));
			expect(filtered.map((r) => r.id).sort()).toEqual(['id005', 'id150']);
		});

		it('does not touch D1 for empty ids, alone or in a batch', async () => {
			const prepare = vi.spyOn(tdb.d1, 'prepare');
			prepare.mockClear();
			expect(await db.run(db.selectByIds('pages', []))).toEqual([]);
			expect(await db.batch([db.selectByIds('pages', []), db.selectByIds('pages', [])])).toEqual([[], []]);
			expect(batchSpy).not.toHaveBeenCalled();
			expect(prepare).not.toHaveBeenCalled();
			prepare.mockRestore();
		});

		it('copes with empty statements mixed into a batch', async () => {
			await db.run(db.insert('pages', doc('a')));
			batchSpy.mockClear();
			const [none, some, n] = await db.batch([
				db.selectByIds('pages', []),
				db.selectByIds('pages', ['a']),
				db.count({ collection: 'pages' }),
			]);
			expect(none).toEqual([]);
			expect(some.map((r) => r.id)).toEqual(['a']);
			expect(n).toBe(1);
			expect(batchSpy).toHaveBeenCalledTimes(1);
		});
	});

	it('runs a batch as one D1 batch call, atomically', async () => {
		batchSpy.mockClear();
		const [a, , rows, total] = await db.batch([
			db.insert('pages', doc('a', { title: 'one' })),
			db.setRefs('pages', 'a', [{ path: 'related', toCollection: 'pages', toId: 'b' }]),
			db.select({ collection: 'pages' }),
			db.count({ collection: 'pages' }),
		]);
		expect(batchSpy).toHaveBeenCalledTimes(1);
		expect(a.id).toBe('a');
		expect(rows).toHaveLength(1);
		expect(total).toBe(1);

		batchSpy.mockClear();
		await expect(
			db.batch([
				db.insert('pages', doc('b', { slug: 'dup1' })),
				db.insert('pages', doc('c', { slug: 'dup1' })),
			]),
		).rejects.toBeInstanceOf(ValidationError);
		expect(batchSpy).toHaveBeenCalledTimes(1);
		// Atomic: the first insert was rolled back.
		expect(await db.run(db.count({ collection: 'pages', where: { id: { equals: 'b' } } }))).toBe(0);
	});

	it('maps UNIQUE violations to a ValidationError on the column', async () => {
		await db.run(db.insert('pages', doc('a', { slug: 's' })));
		const err = await db.run(db.insert('pages', doc('b', { slug: 's' }))).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ValidationError);
		expect((err as ValidationError).errors).toEqual([{ path: 'slug', message: 'Must be unique' }]);
		// Also on update.
		await db.run(db.insert('pages', doc('c', { slug: 't' })));
		await expect(db.run(db.update('pages', 'c', { slug: 's' }))).rejects.toBeInstanceOf(ValidationError);
		// A duplicate primary key is reported on `id`.
		const pk = await db.run(db.insert('pages', doc('a', { slug: 'zzz' }))).catch((e: unknown) => e);
		expect((pk as ValidationError).errors).toEqual([{ path: 'id', message: 'Must be unique' }]);
	});

	describe('_refs', () => {
		const refsOf = async () =>
			(await tdb.d1.prepare('select fromCollection, fromId, path, toCollection, toId from _refs order by fromId, path, toId').all())
				.results;
		const ref = (path: string, toId: string) => ({ path, toCollection: 'pages', toId });

		it('replaces refs', async () => {
			await db.run(db.setRefs('pages', 'a', [ref('related', 'x'), ref('related', 'y')]));
			await db.run(db.setRefs('pages', 'b', [ref('related', 'x')]));
			await db.run(db.setRefs('pages', 'a', [ref('related', 'z')]));
			expect(await refsOf()).toEqual([
				{ fromCollection: 'pages', fromId: 'a', path: 'related', toCollection: 'pages', toId: 'z' },
				{ fromCollection: 'pages', fromId: 'b', path: 'related', toCollection: 'pages', toId: 'x' },
			]);
			await db.run(db.setRefs('pages', 'a', []));
			expect(await refsOf()).toHaveLength(1);
		});

		it('inserts more refs than fit in one statement', async () => {
			const many = Array.from({ length: 100 }, (_, i) => ref('related', `t${i}`));
			await db.run(db.setRefs('pages', 'a', many));
			expect(await refsOf()).toHaveLength(100);
			await db.run(db.setRefs('pages', 'a', []));
			await db.run(db.insert('pages', doc('a')));
			await db.run(db.setRefs('pages', 'a', many, { updatedAt: T0 }));
			expect(await refsOf()).toHaveLength(100);
		});

		it('deleteRefsFrom removes only that document', async () => {
			await db.run(db.setRefs('pages', 'a', [ref('related', 'x')]));
			await db.run(db.setRefs('pages', 'b', [ref('related', 'x')]));
			await db.run(db.deleteRefsFrom('pages', 'a'));
			expect((await refsOf()).map((r) => r.fromId)).toEqual(['b']);
		});

		describe('guard', () => {
			beforeEach(async () => {
				await db.run(db.insert('pages', doc('a')));
				await db.run(db.setRefs('pages', 'a', [ref('related', 'old')]));
			});

			it('leaves refs untouched when the guard does not match', async () => {
				await db.run(db.setRefs('pages', 'a', [ref('related', 'new')], { updatedAt: '2030-01-01T00:00:00.000Z' }));
				expect((await refsOf()).map((r) => r.toId)).toEqual(['old']);
				await db.run(db.setRefs('pages', 'missing', [ref('related', 'new')], { updatedAt: T0 }));
				expect((await refsOf()).map((r) => r.toId)).toEqual(['old']);
			});

			it('applies refs when the guard matches', async () => {
				await db.run(db.setRefs('pages', 'a', [ref('related', 'new')], { updatedAt: T0 }));
				expect((await refsOf()).map((r) => r.toId)).toEqual(['new']);
			});

			it('works with an update in the same batch', async () => {
				const t1 = '2024-02-02T00:00:00.000Z';
				const [updated] = await db.batch([
					db.update('pages', 'a', { updatedAt: t1 }),
					db.setRefs('pages', 'a', [ref('related', 'new')], { updatedAt: t1 }),
				]);
				expect(updated?.updatedAt).toBe(t1);
				expect((await refsOf()).map((r) => r.toId)).toEqual(['new']);
				// The update matched nothing (access where), so the guard fails and refs stay.
				const t2 = '2024-03-03T00:00:00.000Z';
				const [none] = await db.batch([
					db.update('pages', 'a', { updatedAt: t2 }, { id: { equals: 'other' } }),
					db.setRefs('pages', 'a', [ref('related', 'newer')], { updatedAt: t2 }),
				]);
				expect(none).toBeNull();
				expect((await refsOf()).map((r) => r.toId)).toEqual(['new']);
			});

			it('chunks guarded inserts', async () => {
				const many = Array.from({ length: 45 }, (_, i) => ref('related', `t${i}`));
				await db.run(db.setRefs('pages', 'a', many, { updatedAt: T0 }));
				expect(await refsOf()).toHaveLength(45);
			});
		});

		it('refsTo lists incoming refs, excludes self-references, and counts', async () => {
			await db.run(db.setRefs('pages', 'a', [ref('related', 'x')]));
			await db.run(db.setRefs('pages', 'b', [ref('related', 'x'), ref('other', 'x')]));
			await db.run(db.setRefs('pages', 'x', [ref('related', 'x'), ref('related', 'a')]));
			await db.run(db.setRefs('pages', 'c', [{ path: 'cover', toCollection: 'media', toId: 'x' }]));

			const all = await db.run(db.refsTo('pages', 'x', 10));
			expect(all.total).toBe(3);
			expect(all.refs).toEqual([
				{ fromCollection: 'pages', fromId: 'a', path: 'related' },
				{ fromCollection: 'pages', fromId: 'b', path: 'other' },
				{ fromCollection: 'pages', fromId: 'b', path: 'related' },
			]);
			const limited = await db.run(db.refsTo('pages', 'x', 1));
			expect(limited.refs).toHaveLength(1);
			expect(limited.total).toBe(3);
			expect(await db.run(db.refsTo('media', 'x', 5))).toEqual({
				refs: [{ fromCollection: 'pages', fromId: 'c', path: 'cover' }],
				total: 1,
			});
			expect(await db.run(db.refsTo('pages', 'none', 5))).toEqual({ refs: [], total: 0 });
		});
	});
});
