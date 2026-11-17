// The D1 implementation of `DbAdapter`. Statements are lazy: each method builds Drizzle queries
// and a mapper; `batch()` flattens every query of every statement into ONE `d1.batch()` call
// (one round trip, atomic) and slices the results back per statement.
import { and, asc, desc, eq, getTableColumns, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { COLUMN_TYPES, type SanitizedCollection, type SanitizedConfig } from '../config/sanitized';
import type { WhereInput } from '../config/where';
import { QueryError, ValidationError } from '../errors';
import { getTables, type AnyTable } from '../schema/drizzle';
import { REFS_TABLE } from '../schema/spec';
import type { DbAdapter, IncomingRef, Ref, Row, SelectArgs, Stmt } from './adapter';
import { MAX_IN_VALUES, compileWhere } from './where';

/** Rows per `_refs` insert statement: 5 bound params each, plus the guard, under D1's 100 limit. */
const REFS_CHUNK = 18;
/** Drizzle drops negative limits, so "no limit" is a number larger than any table. */
const NO_LIMIT = 2_147_483_647;

// Drizzle query builders are lazy thenables; the adapter only batches them.
type Query = object;

class DbStmt<T> implements Stmt<T> {
	declare readonly '~result'?: T;
	constructor(
		readonly queries: Query[],
		/** Maps this statement's raw results (one per query, in order) to its value. */
		readonly map: (results: unknown[]) => T,
	) {}
}

function asStmt<T>(s: Stmt<T>): DbStmt<T> {
	if (!(s instanceof DbStmt)) throw new Error('kitcms: statement was not created by this adapter.');
	return s;
}

export function createD1Adapter(config: SanitizedConfig, d1: D1Database): DbAdapter {
	const tables = getTables(config);
	const db = drizzle(d1);
	const refsTable = tables[REFS_TABLE]!;
	const refCols = refsTable as unknown as Record<string, SQLiteColumn>;
	const collections = new Map(config.collections.map((c) => [c.slug, c]));

	function ctxOf(slug: string): { col: SanitizedCollection; table: AnyTable } {
		const col = collections.get(slug);
		const table = tables[slug];
		if (!col || !table) throw new QueryError(`Unknown collection "${slug}".`);
		return { col, table };
	}

	function condition(slug: string, where: WhereInput | undefined): SQL | undefined {
		const { col, table } = ctxOf(slug);
		return compileWhere({ collection: col, table, refs: refsTable }, where);
	}

	// ----- row conversion -------------------------------------------------------------------

	function toDoc(raw: Record<string, unknown>): Row {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(raw)) out[k] = v instanceof Date ? v.toISOString() : v;
		return out as Row;
	}

	function toDb(table: AnyTable, doc: Record<string, unknown>): Record<string, unknown> {
		const columns = getTableColumns(table);
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(doc)) {
			const column = Object.hasOwn(columns, k) ? columns[k] : undefined;
			if (!column || v === undefined) continue;
			if (column.dataType === 'date' && typeof v === 'string') {
				const d = new Date(v);
				if (Number.isNaN(d.getTime())) throw new ValidationError([{ path: k, message: 'Invalid date' }]);
				out[k] = d;
			} else out[k] = v;
		}
		return out;
	}

	const one = (results: unknown[]): Row | null => {
		const rows = results[0] as Record<string, unknown>[];
		return rows[0] ? toDoc(rows[0]) : null;
	};

	// ----- execution ------------------------------------------------------------------------

	function mapError(err: unknown): unknown {
		for (let e: unknown = err, i = 0; e && i < 5; i++) {
			const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
			const m = /UNIQUE constraint failed: ([^:]+)/.exec(msg);
			if (m) {
				const first = m[1]!.split(',')[0]!.trim();
				const column = first.slice(first.lastIndexOf('.') + 1);
				return new ValidationError([{ path: column, message: 'Must be unique' }]);
			}
			e = (e as { cause?: unknown }).cause;
		}
		return err;
	}

	async function batch(stmts: readonly Stmt<unknown>[]): Promise<unknown[]> {
		const list = stmts.map(asStmt);
		const queries = list.flatMap((s) => s.queries);
		let results: unknown[] = [];
		if (queries.length) {
			try {
				results = (await db.batch(queries as never)) as unknown[];
			} catch (err) {
				throw mapError(err);
			}
		}
		let at = 0;
		return list.map((s) => {
			const slice = results.slice(at, at + s.queries.length);
			at += s.queries.length;
			return s.map(slice);
		});
	}

	// ----- reads ----------------------------------------------------------------------------

	function orderBy(slug: string, sort: string[] | undefined): SQL[] {
		const { col, table } = ctxOf(slug);
		const columnFields = new Set(
			col.fields.filter((f) => (COLUMN_TYPES as readonly string[]).includes(f.type)).map((f) => f.name),
		);
		const order: SQL[] = [];
		let dir = asc;
		for (const key of sort ?? []) {
			const desc_ = key.startsWith('-');
			const name = desc_ ? key.slice(1) : key;
			const system = name === 'id' || name === 'createdAt' || name === 'updatedAt';
			if (!system && !columnFields.has(name)) {
				throw new QueryError(`Can't sort by "${name}" on collection "${slug}".`);
			}
			dir = desc_ ? desc : asc;
			order.push(dir(table[name] as SQLiteColumn));
		}
		order.push(dir(table.id as SQLiteColumn));
		return order;
	}

	function select(args: SelectArgs): Stmt<Row[]> {
		const { table } = ctxOf(args.collection);
		const order = orderBy(args.collection, args.sort);
		let q = db.select().from(table).where(condition(args.collection, args.where)).orderBy(...order);
		if (args.limit !== undefined) q = q.limit(args.limit) as typeof q;
		else if (args.offset) q = q.limit(NO_LIMIT) as typeof q; // SQLite needs a LIMIT to take an OFFSET
		if (args.offset) q = q.offset(args.offset) as typeof q;
		return new DbStmt([q], (r) => (r[0] as Record<string, unknown>[]).map(toDoc));
	}

	function selectByIds(slug: string, ids: string[], where?: WhereInput): Stmt<Row[]> {
		const { table } = ctxOf(slug);
		const extra = condition(slug, where);
		const unique = [...new Set(ids)];
		const queries: Query[] = [];
		for (let i = 0; i < unique.length; i += MAX_IN_VALUES) {
			const chunk = unique.slice(i, i + MAX_IN_VALUES);
			queries.push(
				db.select().from(table).where(and(inArray(table.id as SQLiteColumn, chunk), extra)),
			);
		}
		return new DbStmt(queries, (results) =>
			results.flatMap((r) => (r as Record<string, unknown>[]).map(toDoc)),
		);
	}

	function count(args: { collection: string; where?: WhereInput }): Stmt<number> {
		const { table } = ctxOf(args.collection);
		const q = db
			.select({ n: sql<number>`count(*)` })
			.from(table)
			.where(condition(args.collection, args.where));
		return new DbStmt([q], (r) => Number((r[0] as { n: number }[])[0]?.n ?? 0));
	}

	// ----- writes ---------------------------------------------------------------------------

	function insert(slug: string, doc: Row): Stmt<Row> {
		const { table } = ctxOf(slug);
		const q = db.insert(table).values(toDb(table, doc) as never).returning();
		return new DbStmt([q], (r) => {
			const row = one(r);
			if (!row) throw new Error(`kitcms: insert into "${slug}" returned no row.`);
			return row;
		});
	}

	function update(slug: string, id: string, values: Partial<Row>, where?: WhereInput): Stmt<Row | null> {
		const { table } = ctxOf(slug);
		const cond = and(eq(table.id as SQLiteColumn, id), condition(slug, where));
		const set = toDb(table, values);
		delete set.id;
		if (Object.keys(set).length === 0) {
			// Nothing to write: behave as "return the row if it matches".
			return new DbStmt([db.select().from(table).where(cond).limit(1)], one);
		}
		return new DbStmt([db.update(table).set(set as never).where(cond).returning()], one);
	}

	function del(slug: string, id: string, where?: WhereInput): Stmt<Row | null> {
		const { table } = ctxOf(slug);
		const cond = and(eq(table.id as SQLiteColumn, id), condition(slug, where));
		return new DbStmt([db.delete(table).where(cond).returning()], one);
	}

	// ----- _refs ----------------------------------------------------------------------------

	function setRefs(
		fromCollection: string,
		fromId: string,
		refs: Ref[],
		guard?: { updatedAt: string },
	): Stmt<void> {
		const { table } = ctxOf(fromCollection);
		const owner = (id: string) => eq(refCols.fromId!, id);
		const fromColl = eq(refCols.fromCollection!, fromCollection);
		let exists: SQL | undefined;
		if (guard) {
			const ms = new Date(guard.updatedAt).getTime();
			if (!Number.isFinite(ms)) throw new QueryError('setRefs: invalid guard.updatedAt.');
			exists = sql`exists (select 1 from ${table} where ${table.id} = ${fromId} and ${table.updatedAt} = ${ms})`;
		}
		const queries: Query[] = [
			db.delete(refsTable).where(and(fromColl, owner(fromId), exists)),
		];
		for (let i = 0; i < refs.length; i += REFS_CHUNK) {
			const chunk = refs.slice(i, i + REFS_CHUNK);
			if (!exists) {
				queries.push(
					db.insert(refsTable).values(
						chunk.map((r) => ({
							fromCollection,
							fromId,
							path: r.path,
							toCollection: r.toCollection,
							toId: r.toId,
						})) as never,
					),
				);
			} else {
				const rows = sql.join(
					chunk.map((r) => sql`(${fromCollection}, ${fromId}, ${r.path}, ${r.toCollection}, ${r.toId})`),
					sql`, `,
				);
				// `db.run(sql)` isn't batchable on the D1 driver, so go through insert ... select.
				queries.push(
					db.insert(refsTable).select(sql`select * from (values ${rows}) where ${exists}` as never),
				);
			}
		}
		return new DbStmt(queries, () => undefined);
	}

	function deleteRefsFrom(fromCollection: string, fromId: string): Stmt<void> {
		return new DbStmt(
			[db.delete(refsTable).where(and(eq(refCols.fromCollection!, fromCollection), eq(refCols.fromId!, fromId)))],
			() => undefined,
		);
	}

	function refsTo(
		toCollection: string,
		toId: string,
		limit: number,
	): Stmt<{ refs: IncomingRef[]; total: number }> {
		const cond = and(
			eq(refCols.toCollection!, toCollection),
			eq(refCols.toId!, toId),
			or(ne(refCols.fromCollection!, toCollection), ne(refCols.fromId!, toId)),
		);
		const rows = db
			.select({
				fromCollection: refCols.fromCollection!,
				fromId: refCols.fromId!,
				path: refCols.path!,
			})
			.from(refsTable)
			.where(cond)
			.orderBy(asc(refCols.fromCollection!), asc(refCols.fromId!), asc(refCols.path!))
			.limit(limit);
		const total = db.select({ n: sql<number>`count(*)` }).from(refsTable).where(cond);
		return new DbStmt([rows, total], (r) => ({
			refs: r[0] as IncomingRef[],
			total: Number((r[1] as { n: number }[])[0]?.n ?? 0),
		}));
	}

	return {
		select,
		selectByIds,
		count,
		insert,
		update,
		delete: del,
		setRefs,
		deleteRefsFrom,
		refsTo,
		batch: ((stmts: readonly Stmt<unknown>[]) => batch(stmts)) as DbAdapter['batch'],
		run: async <T>(stmt: Stmt<T>) => (await batch([stmt]))[0] as T,
	};
}
