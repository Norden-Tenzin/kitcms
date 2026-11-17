// `where` DSL → Drizzle SQL. Semantics are specified in ../config/where.ts; this is the only
// place a caller-supplied `where` becomes SQL. Everything is bound as parameters, and field and
// operator names are checked against the config, so untyped REST/RPC input can't reach SQL text.
import {
	and,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	lte,
	ne,
	notInArray,
	or,
	sql,
	type SQL,
} from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { STATUS_FIELD, type SanitizedCollection } from '../config/sanitized';
import type { WhereInput } from '../config/where';
import { QueryError } from '../errors';
import type { AnyTable } from '../schema/drizzle';

export interface WhereContext {
	collection: SanitizedCollection;
	table: AnyTable;
	/** The `_refs` table. */
	refs: AnyTable;
}

/** Deepest allowed `and`/`or` nesting. */
export const MAX_WHERE_DEPTH = 8;
/** D1 allows 100 bound parameters per statement; leave room for the rest of the query. */
export const MAX_IN_VALUES = 90;

type Kind = 'id' | 'text' | 'number' | 'checkbox' | 'date' | 'rel' | 'many';

interface Target {
	kind: Kind;
	name: string;
	col: SQLiteColumn;
}

const SYSTEM = new Set(['id', 'createdAt', 'updatedAt']);
const TEXT_TYPES = new Set(['text', 'textarea', 'email', 'slug', 'select']);

const OPS_BY_KIND: Record<Kind, readonly string[]> = {
	id: ['equals', 'not_equals', 'in', 'not_in', 'exists', 'like'],
	text: [
		'equals', 'not_equals', 'in', 'not_in', 'exists', 'like',
		'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal',
	],
	number: [
		'equals', 'not_equals', 'in', 'not_in', 'exists',
		'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal',
	],
	date: [
		'equals', 'not_equals', 'in', 'not_in', 'exists',
		'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal',
	],
	checkbox: ['equals', 'not_equals', 'in', 'not_in', 'exists'],
	rel: ['equals', 'not_equals', 'in', 'not_in', 'exists'],
	many: ['contains', 'in', 'not_in', 'exists'],
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function resolve(ctx: WhereContext, name: string): Target {
	const col = (ctx.table as Record<string, SQLiteColumn | undefined>)[name];
	if (
		name === STATUS_FIELD &&
		col &&
		ctx.collection.versions !== false &&
		ctx.collection.versions.drafts !== false
	) {
		return { kind: 'text', name, col };
	}
	if (SYSTEM.has(name)) {
		if (!col) throw new QueryError(`Unknown field "${name}".`);
		return { kind: name === 'id' ? 'id' : 'date', name, col };
	}
	const field = ctx.collection.fields.find((f) => f.name === name);
	if (!field || !col || !Object.hasOwn(ctx.table, name)) {
		throw new QueryError(`Unknown field "${name}" on collection "${ctx.collection.slug}".`);
	}
	if (TEXT_TYPES.has(field.type)) return { kind: 'text', name, col };
	switch (field.type) {
		case 'number':
			return { kind: 'number', name, col };
		case 'checkbox':
			return { kind: 'checkbox', name, col };
		case 'date':
			return { kind: 'date', name, col };
		case 'relationship':
		case 'upload':
			return { kind: field.hasMany ? 'many' : 'rel', name, col };
		default:
			throw new QueryError(
				`Field "${name}" (${field.type}) is stored as JSON and can't be used in a query.`,
			);
	}
}

/** ISO string, Date or epoch ms → epoch ms. */
function toMs(v: unknown, label: string): number {
	let ms: number;
	if (v instanceof Date) ms = v.getTime();
	else if (typeof v === 'number') ms = v;
	else if (typeof v === 'string') ms = Date.parse(v);
	else ms = Number.NaN;
	if (!Number.isFinite(ms)) throw new QueryError(`${label}: expected a valid date.`);
	return ms;
}

/** Validates and converts one scalar to the value bound against the column. */
function scalar(t: Target, v: unknown, op: string): unknown {
	const label = `"${t.name}" ${op}`;
	switch (t.kind) {
		case 'id':
		case 'text':
		case 'rel':
		case 'many':
			if (typeof v !== 'string') throw new QueryError(`${label}: expected a string.`);
			return v;
		case 'number':
			if (typeof v !== 'number' || !Number.isFinite(v)) {
				throw new QueryError(`${label}: expected a number.`);
			}
			return v;
		case 'checkbox':
			if (typeof v !== 'boolean') throw new QueryError(`${label}: expected a boolean.`);
			return v;
		case 'date':
			return new Date(toMs(v, label));
	}
}

function list(t: Target, v: unknown, op: string): unknown[] {
	if (!Array.isArray(v)) throw new QueryError(`"${t.name}" ${op}: expected an array.`);
	if (v.length > MAX_IN_VALUES) {
		throw new QueryError(`"${t.name}" ${op}: at most ${MAX_IN_VALUES} values are allowed.`);
	}
	return v.map((x) => scalar(t, x, op));
}

const FALSE = sql`0`;
const TRUE = sql`1`;

function req(sqlExpr: SQL | undefined): SQL {
	return sqlExpr ?? TRUE;
}

function manyCondition(ctx: WhereContext, t: Target, toIds: string[], negate = false): SQL {
	const r = ctx.refs as unknown as Record<string, SQLiteColumn>;
	return sql`${ctx.table.id} ${negate ? sql`not in` : sql`in`} (select ${r.fromId} from ${ctx.refs} where ${r.fromCollection} = ${ctx.collection.slug} and ${r.path} = ${t.name} and ${inArray(r.toId!, toIds)})`;
}

function fieldConditions(ctx: WhereContext, t: Target, ops: Record<string, unknown>): SQL[] {
	const out: SQL[] = [];
	const allowed = OPS_BY_KIND[t.kind];
	for (const [op, value] of Object.entries(ops)) {
		if (value === undefined) continue;
		if (!allowed.includes(op)) {
			throw new QueryError(`Operator "${op}" is not supported on field "${t.name}".`);
		}
		const { col } = t;
		if (t.kind === 'many') {
			if (op === 'exists') {
				if (typeof value !== 'boolean') throw new QueryError(`"${t.name}" exists: expected a boolean.`);
				out.push(
					value
						? sql`json_array_length(${col}) > 0`
						: sql`(${col} is null or json_array_length(${col}) = 0)`,
				);
			} else if (op === 'contains') {
				out.push(manyCondition(ctx, t, [scalar(t, value, op) as string]));
			} else {
				const ids = list(t, value, op) as string[];
				if (op === 'in') out.push(ids.length ? manyCondition(ctx, t, ids) : FALSE);
				else if (ids.length) out.push(manyCondition(ctx, t, ids as string[], true));
			}
			continue;
		}
		switch (op) {
			case 'equals':
				out.push(value === null ? isNull(col) : eq(col, scalar(t, value, op)));
				break;
			case 'not_equals':
				out.push(
					value === null ? isNotNull(col) : req(or(ne(col, scalar(t, value, op)), isNull(col))),
				);
				break;
			case 'in': {
				const vs = list(t, value, op);
				out.push(vs.length ? inArray(col, vs) : FALSE);
				break;
			}
			case 'not_in': {
				const vs = list(t, value, op);
				if (vs.length) out.push(req(or(notInArray(col, vs), isNull(col))));
				break;
			}
			case 'exists':
				if (typeof value !== 'boolean') throw new QueryError(`"${t.name}" exists: expected a boolean.`);
				out.push(value ? isNotNull(col) : isNull(col));
				break;
			case 'like': {
				if (typeof value !== 'string') throw new QueryError(`"${t.name}" like: expected a string.`);
				const pattern = `%${value.replace(/[\\%_]/g, '\\$&')}%`;
				out.push(sql`lower(${col}) like lower(${pattern}) escape '\\'`);
				break;
			}
			default: {
				const cmp = { greater_than: gt, greater_than_equal: gte, less_than: lt, less_than_equal: lte }[
					op as 'greater_than'
				];
				out.push(cmp(col, scalar(t, value, op)));
			}
		}
	}
	return out;
}

function compile(ctx: WhereContext, where: WhereInput, depth: number): SQL | undefined {
	if (depth > MAX_WHERE_DEPTH) {
		throw new QueryError(`\`where\` is nested too deeply (maximum ${MAX_WHERE_DEPTH} levels).`);
	}
	if (!isPlainObject(where)) throw new QueryError('`where` must be an object.');
	const parts: SQL[] = [];
	for (const [key, value] of Object.entries(where)) {
		if (value === undefined) continue;
		if (key === 'and' || key === 'or') {
			if (!Array.isArray(value)) throw new QueryError(`\`${key}\` must be an array of where objects.`);
			const subs = value.map((w) => compile(ctx, w as WhereInput, depth + 1) ?? TRUE);
			if (key === 'and') parts.push(...subs.map((s) => sql`(${s})`));
			else parts.push(subs.length ? sql`(${sql.join(subs.map((s) => sql`(${s})`), sql` or `)})` : FALSE);
			continue;
		}
		const target = resolve(ctx, key);
		if (!isPlainObject(value)) {
			throw new QueryError(
				`"${key}": expected an object of operators such as { equals: ... }, not a bare value.`,
			);
		}
		parts.push(...fieldConditions(ctx, target, value));
	}
	return parts.length ? and(...parts) : undefined;
}

/** Compiles a `where` to a SQL condition. `undefined` means "no condition" (match everything). */
export function compileWhere(ctx: WhereContext, where: WhereInput | undefined): SQL | undefined {
	if (where === undefined || where === null) return undefined;
	return compile(ctx, where, 0);
}
