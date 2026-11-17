import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import type { SQL } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../test/d1';
import { collection, defineConfig } from '../config/collection';
import { fields as f } from '../config/fields';
import { sanitizeConfig } from '../config/sanitize';
import type { WhereInput } from '../config/where';
import { QueryError } from '../errors';
import { getTables } from '../schema/drizzle';
import type { DbAdapter, Row } from './adapter';
import { createD1Adapter } from './d1';
import { compileWhere } from './where';

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({
				slug: 'pages',
				fields: {
					title: f.text(),
					views: f.number(),
					featured: f.checkbox(),
					status: f.select({ options: ['draft', 'live'] }),
					publishedAt: f.date(),
					parent: f.relationship({ relationTo: 'pages' }),
					related: f.relationship({ relationTo: 'pages', hasMany: true }),
					meta: f.json(),
					seo: f.group({ fields: { title: f.text() } }),
				},
			} as never),
		],
	}),
);
const tables = getTables(config);
const pagesCol = config.collections.find((c) => c.slug === 'pages')!;
const ctx = { collection: pagesCol, table: tables.pages!, refs: tables._refs! };
const dialect = new SQLiteSyncDialect();
const compile = (where: WhereInput | undefined) => compileWhere(ctx, where);
const toQuery = (s: SQL | undefined) => dialect.sqlToQuery(s!);

describe('compileWhere (SQL shape)', () => {
	it('returns undefined for empty input', () => {
		expect(compile(undefined)).toBeUndefined();
		expect(compile({})).toBeUndefined();
	});

	it('binds values as params', () => {
		const q = toQuery(compile({ title: { equals: "x'; drop table pages; --" } }));
		expect(q.sql).toBe('"pages"."title" = ?');
		expect(q.params).toEqual(["x'; drop table pages; --"]);
	});

	it('compiles null handling', () => {
		expect(toQuery(compile({ title: { equals: null } })).sql).toBe('"pages"."title" is null');
		expect(toQuery(compile({ title: { not_equals: null } })).sql).toBe('"pages"."title" is not null');
		expect(toQuery(compile({ title: { not_equals: 'a' } })).sql).toBe(
			'("pages"."title" <> ? or "pages"."title" is null)',
		);
	});

	it('escapes like', () => {
		const q = toQuery(compile({ title: { like: '50%_\\' } }));
		expect(q.sql).toContain("escape '\\'");
		expect(q.params).toEqual(['%50\\%\\_\\\\%']);
	});

	it('converts dates to epoch ms', () => {
		const iso = '2024-01-01T00:00:00.000Z';
		const q = toQuery(compile({ publishedAt: { greater_than: iso } }));
		expect(q.sql).toBe('"pages"."publishedAt" > ?');
		expect(q.params).toEqual([Date.parse(iso)]);
		const q2 = toQuery(compile({ createdAt: { less_than_equal: new Date(5) } }));
		expect(q2.params).toEqual([5]);
	});

	it('compiles hasMany through _refs', () => {
		const q = toQuery(compile({ related: { contains: 'x' } }));
		expect(q.sql).toContain('from "_refs"');
		expect(q.sql).toContain('"_refs"."toId" in (?)');
		expect(q.params).toEqual(['pages', 'related', 'x']);
	});
});

describe('compileWhere (QueryError)', () => {
	const bad: [string, WhereInput][] = [
		['unknown field', { nope: { equals: 1 } }],
		['prototype key', { constructor: { equals: 1 } }],
		['JSON field', { meta: { equals: 'x' } }],
		['group field', { seo: { exists: true } }],
		['bare value', { title: 'x' } as never],
		['array as field value', { title: ['x'] } as never],
		['unknown operator', { title: { regex: 'x' } }],
		['range on checkbox', { featured: { greater_than: true } }],
		['like on number', { views: { like: '1' } }],
		['like needs string', { title: { like: 1 } }],
		['in needs array', { title: { in: 'a' } }],
		['not_in needs array', { title: { not_in: 'a' } }],
		['in value types', { views: { in: ['a'] } }],
		['number type', { views: { equals: '1' } }],
		['NaN number', { views: { greater_than: Number.NaN } }],
		['checkbox type', { featured: { equals: 'true' } }],
		['invalid date', { publishedAt: { equals: 'not a date' } }],
		['invalid system date', { createdAt: { greater_than: {} } }],
		['exists type', { title: { exists: 'yes' } }],
		['and not array', { and: {} } as never],
		['or not array', { or: 'x' } as never],
		['contains on non-many', { title: { contains: 'x' } }],
		['equals on hasMany', { related: { equals: 'x' } }],
		['range on relationship', { parent: { greater_than: 'a' } }],
		['contains needs string', { related: { contains: 1 } }],
		['too many in values', { title: { in: Array.from({ length: 91 }, (_, i) => `v${i}`) } }],
		['too many hasMany values', { related: { in: Array.from({ length: 91 }, (_, i) => `v${i}`) } }],
		['bad nested and', { and: [{ nope: { equals: 1 } }] }],
		['non-object entry', { or: ['x'] } as never],
	];
	it.each(bad)('%s', (_name, where) => {
		expect(() => compile(where)).toThrow(QueryError);
	});

	it('names the field in the message', () => {
		expect(() => compile({ nope: { equals: 1 } })).toThrow(/nope/);
		expect(() => compile({ meta: { equals: 1 } })).toThrow(/meta/);
	});

	it('caps nesting at 8', () => {
		const nest = (n: number): WhereInput => (n === 0 ? {} : { and: [nest(n - 1)] });
		expect(() => compile(nest(8))).not.toThrow();
		expect(() => compile(nest(9))).toThrow(/nested too deeply/);
	});

	it('allows 90 values', () => {
		const ninety = Array.from({ length: 90 }, (_, i) => `v${i}`);
		expect(() => compile({ title: { in: ninety } })).not.toThrow();
	});
});

describe('where against D1', () => {
	let tdb: TestDb;
	let db: DbAdapter;
	const t = (iso: string) => iso;
	const mk = (id: string, extra: Record<string, unknown>): Row => ({
		id,
		createdAt: t('2024-01-01T00:00:00.000Z'),
		updatedAt: t('2024-01-01T00:00:00.000Z'),
		...extra,
	});
	const ids = async (where: WhereInput | undefined) =>
		(await db.run(db.select({ collection: 'pages', where, sort: ['id'] }))).map((r) => r.id);

	beforeAll(async () => {
		tdb = await createTestDb(config);
		db = createD1Adapter(config, tdb.d1);
		const rows = [
			mk('p1', { title: 'Alpha', views: 1, featured: true, status: 'draft', publishedAt: '2024-01-01T00:00:00.000Z', parent: null, related: [] }),
			mk('p2', { title: 'Beta 100%', views: 5, featured: false, status: 'live', publishedAt: '2024-06-01T00:00:00.000Z', parent: 'p1', related: ['p1'], createdAt: '2024-02-01T00:00:00.000Z' }),
			mk('p3', { title: 'gamma_x', views: 9, featured: false, status: null, publishedAt: null, parent: 'p1', related: ['p1', 'p2'], createdAt: '2024-03-01T00:00:00.000Z' }),
			mk('p4', { title: 'Delta\\path', views: null, featured: false, status: 'live', related: null, createdAt: '2024-04-01T00:00:00.000Z' }),
		];
		for (const r of rows) {
			await db.batch([
				db.insert('pages', r),
				db.setRefs('pages', r.id, ((r.related as string[] | null) ?? []).map((toId) => ({ path: 'related', toCollection: 'pages', toId }))),
			]);
		}
	});
	afterAll(() => tdb.dispose());

	it('matches everything for empty where', async () => {
		expect(await ids(undefined)).toEqual(['p1', 'p2', 'p3', 'p4']);
		expect(await ids({})).toEqual(['p1', 'p2', 'p3', 'p4']);
		expect(await ids({ and: [] })).toEqual(['p1', 'p2', 'p3', 'p4']);
	});

	it('or: [] matches nothing', async () => {
		expect(await ids({ or: [] })).toEqual([]);
	});

	it('equals / not_equals treat null correctly', async () => {
		expect(await ids({ status: { equals: 'live' } })).toEqual(['p2', 'p4']);
		expect(await ids({ status: { not_equals: 'live' } })).toEqual(['p1', 'p3']);
		expect(await ids({ status: { equals: null } })).toEqual(['p3']);
		expect(await ids({ status: { not_equals: null } })).toEqual(['p1', 'p2', 'p4']);
		expect(await ids({ parent: { equals: 'p1' } })).toEqual(['p2', 'p3']);
	});

	it('in / not_in', async () => {
		expect(await ids({ status: { in: ['draft', 'live'] } })).toEqual(['p1', 'p2', 'p4']);
		expect(await ids({ status: { in: [] } })).toEqual([]);
		expect(await ids({ status: { not_in: ['live'] } })).toEqual(['p1', 'p3']);
		expect(await ids({ status: { not_in: [] } })).toEqual(['p1', 'p2', 'p3', 'p4']);
	});

	it('exists', async () => {
		expect(await ids({ status: { exists: true } })).toEqual(['p1', 'p2', 'p4']);
		expect(await ids({ status: { exists: false } })).toEqual(['p3']);
	});

	it('numeric ranges and ANDed operators', async () => {
		expect(await ids({ views: { greater_than: 1 } })).toEqual(['p2', 'p3']);
		expect(await ids({ views: { greater_than_equal: 1, less_than: 9 } })).toEqual(['p1', 'p2']);
		expect(await ids({ views: { less_than_equal: 5 } })).toEqual(['p1', 'p2']);
	});

	it('checkbox booleans', async () => {
		expect(await ids({ featured: { equals: true } })).toEqual(['p1']);
		expect(await ids({ featured: { equals: false } })).toEqual(['p2', 'p3', 'p4']);
	});

	it('like is a case-insensitive substring match with escaping', async () => {
		expect(await ids({ title: { like: 'ALPHA' } })).toEqual(['p1']);
		expect(await ids({ title: { like: 'eta' } })).toEqual(['p2']);
		expect(await ids({ title: { like: '%' } })).toEqual(['p2']);
		expect(await ids({ title: { like: '_' } })).toEqual(['p3']);
		expect(await ids({ title: { like: '\\' } })).toEqual(['p4']);
		expect(await ids({ title: { like: 'a_p' } })).toEqual([]);
		expect(await ids({ id: { like: 'p' } })).toEqual(['p1', 'p2', 'p3', 'p4']);
	});

	it('lexical ranges on text', async () => {
		expect(await ids({ title: { less_than: 'B' } })).toEqual(['p1']);
	});

	it('date ranges accept ISO strings, Dates and epoch ms', async () => {
		const jun = '2024-06-01T00:00:00.000Z';
		expect(await ids({ publishedAt: { greater_than_equal: jun } })).toEqual(['p2']);
		expect(await ids({ publishedAt: { greater_than_equal: new Date(jun) } })).toEqual(['p2']);
		expect(await ids({ publishedAt: { greater_than_equal: Date.parse(jun) } })).toEqual(['p2']);
		expect(await ids({ publishedAt: { less_than: jun } })).toEqual(['p1']);
		expect(await ids({ publishedAt: { equals: jun } })).toEqual(['p2']);
		expect(await ids({ publishedAt: { not_equals: jun } })).toEqual(['p1', 'p3', 'p4']);
		expect(await ids({ createdAt: { greater_than: '2024-02-15T00:00:00.000Z' } })).toEqual(['p3', 'p4']);
		expect(await ids({ updatedAt: { equals: '2024-01-01T00:00:00.000Z' } })).toEqual(['p1', 'p2', 'p3', 'p4']);
	});

	it('and / or nesting', async () => {
		expect(await ids({ or: [{ status: { equals: 'draft' } }, { views: { greater_than: 5 } }] })).toEqual(['p1', 'p3']);
		expect(
			await ids({
				status: { equals: 'live' },
				or: [{ views: { equals: 5 } }, { title: { like: 'delta' } }],
			}),
		).toEqual(['p2', 'p4']);
		expect(
			await ids({ and: [{ or: [{ id: { equals: 'p1' } }, { id: { equals: 'p2' } }] }, { featured: { equals: false } }] }),
		).toEqual(['p2']);
		// A caller `or` can't widen an ANDed group.
		expect(await ids({ and: [{ id: { equals: 'p1' } }, { or: [{ id: { equals: 'p2' } }] }] })).toEqual([]);
	});

	it('hasMany contains / in / not_in / exists', async () => {
		expect(await ids({ related: { contains: 'p1' } })).toEqual(['p2', 'p3']);
		expect(await ids({ related: { contains: 'p2' } })).toEqual(['p3']);
		expect(await ids({ related: { in: ['p2', 'p9'] } })).toEqual(['p3']);
		expect(await ids({ related: { in: [] } })).toEqual([]);
		expect(await ids({ related: { not_in: ['p2'] } })).toEqual(['p1', 'p2', 'p4']);
		expect(await ids({ related: { not_in: [] } })).toEqual(['p1', 'p2', 'p3', 'p4']);
		expect(await ids({ related: { exists: true } })).toEqual(['p2', 'p3']);
		expect(await ids({ related: { exists: false } })).toEqual(['p1', 'p4']);
		expect(await ids({ related: { contains: 'p1' }, views: { greater_than: 5 } })).toEqual(['p3']);
	});

	it('hasMany filters only see this collection and path', async () => {
		await tdb.d1
			.prepare("insert into _refs values ('other','p4','related','pages','p1'),('pages','p4','elsewhere','pages','p1')")
			.run();
		expect(await ids({ related: { contains: 'p1' } })).toEqual(['p2', 'p3']);
	});

	it('count and selectByIds honour where', async () => {
		expect(await db.run(db.count({ collection: 'pages', where: { featured: { equals: false } } }))).toBe(3);
		const rows = await db.run(db.selectByIds('pages', ['p1', 'p2', 'p3'], { views: { greater_than: 1 } }));
		expect(rows.map((r) => r.id).sort()).toEqual(['p2', 'p3']);
	});
});
