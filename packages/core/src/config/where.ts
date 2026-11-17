// The `where` query DSL: types and the semantics every implementation must follow.
//
// SEMANTICS (the contract for the where → SQL compiler, plan §4.3 / §7 "where DSL"):
// - A `where` object is a conjunction: every field key and every `and`/`or` entry must hold.
//   `{}` and `undefined` match everything.
// - `and: [w1, w2]` → w1 AND w2. `or: [w1, w2]` → w1 OR w2. `or: []` matches nothing,
//   `and: []` matches everything. Nesting is allowed to any depth (the compiler caps it at 8).
// - Several operators on one field are ANDed: `{ views: { greater_than: 1, less_than: 9 } }`.
// - Filterable fields: `id`, `createdAt`, `updatedAt`, every top-level column field
//   (text, textarea, email, slug, number, checkbox, select, date, single relationship/upload),
//   and top-level hasMany relationship/upload fields. Fields stored as JSON (group, array,
//   blocks, json, richText) cannot be filtered in v1. An unknown or non-filterable field throws
//   a `QueryError` (REST/RPC callers are untyped, so this is checked at runtime too).
// - Operators, per value type:
//   equals / not_equals:   `= v` / `(col <> v OR col IS NULL)`. `equals: null` → `IS NULL`,
//                          `not_equals: null` → `IS NOT NULL`.
//   in / not_in:           `IN (...)` / `(col NOT IN (...) OR col IS NULL)`. `in: []` matches
//                          nothing, `not_in: []` matches everything.
//   exists:                true → `IS NOT NULL`, false → `IS NULL`.
//   greater_than(_equal), less_than(_equal): numbers and dates only.
//   like:                  strings only. Case-insensitive substring match; `%`, `_` and `\` in
//                          the value are escaped (it is not a pattern language).
//   hasMany fields:        `contains: id` (the list includes id), `in: ids` (includes any),
//                          `not_in: ids` (includes none), `exists` (non-empty list).
//                          Answered through the `_refs` table.
// - Values: dates accept an ISO string, a `Date` or epoch ms, and compare as epoch ms.
//   Checkbox values must be booleans. Everything else is compared as given.
// - Access control: a `where` returned by an access rule is ANDed with the caller's `where` as a
//   separate group, so a caller's `or` can never widen it (see ../access).

import type { Rel } from './infer';

type Scalar = string | number | boolean;

/** Operators available on a field whose (non-null) value type is `V`. */
export type WhereOps<V> = V extends readonly Rel<string>[]
	? { contains?: string; in?: string[]; not_in?: string[]; exists?: boolean }
	: {
			equals?: WhereValue<V> | null;
			not_equals?: WhereValue<V> | null;
			in?: WhereValue<V>[];
			not_in?: WhereValue<V>[];
			exists?: boolean;
		} & (V extends number
			? Range<number>
			: V extends string
				? { like?: string } & Range<string | Date | number>
				: unknown);

type Range<V> = {
	greater_than?: V;
	greater_than_equal?: V;
	less_than?: V;
	less_than_equal?: V;
};

/** Relationship ids are compared as plain strings. */
type WhereValue<V> = V extends Rel<string> ? string : V;

type Filterable<V> = V extends Scalar ? true : V extends readonly Rel<string>[] ? true : false;

/** A typed filter over a document's top-level filterable fields. Untyped docs take `WhereInput`. */
export type Where<Doc> = string extends keyof Doc ? WhereInput : TypedWhere<Doc>;
type TypedWhere<Doc> = {
	[K in keyof Doc as Filterable<NonNullable<Doc[K]>> extends true ? K : never]?: WhereOps<
		NonNullable<Doc[K]>
	>;
} & { and?: TypedWhere<Doc>[]; or?: TypedWhere<Doc>[] };

/** The untyped form used inside core and over RPC/REST. */
export interface WhereInput {
	and?: WhereInput[];
	or?: WhereInput[];
	[field: string]: Record<string, unknown> | WhereInput[] | undefined;
}

/** `'title'` ascending, `'-title'` descending. */
export type Sort<Doc> = `${'-' | ''}${keyof Doc & string}`;
