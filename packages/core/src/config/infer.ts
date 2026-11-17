// Type-level inference: fields → document shapes. See the rules at the top of ./fields.ts.
// Everything here is computed once per builder call and stored in phantoms (`'~out'`, `'~in'`,
// `'~doc'`), so the Local API only does indexed lookups.

import type { BlockDef, FieldDef, Fields } from './fields';

/**
 * A relationship value before population: the target's id, branded with the target slug.
 * The brand is required (an optional brand would make every string match `Rel<infer To>`) and
 * string-keyed (a `unique symbol` can't be named in emitted declarations, TS4023).
 * Branded ids are still assignable to `string`.
 */
export type Rel<To extends string> = string & { readonly '~rel': To };

/** Flattens intersections for readable hovers. */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Tiptap / ProseMirror JSON. */
export interface RichTextDoc {
	type: 'doc';
	content?: RichTextNode[];
}
export interface RichTextNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: RichTextNode[];
	text?: string;
	marks?: { type: string; attrs?: Record<string, unknown> }[];
}

type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (
	i: infer I,
) => void
	? I
	: never;

type IsLayout<T> = T extends { readonly '~layout': true } ? true : false;
type DataKeys<F extends Fields> = {
	[K in keyof F]: IsLayout<F[K]> extends true ? never : K;
}[keyof F];
type LayoutKeys<F extends Fields> = Exclude<keyof F, DataKeys<F>>;

type ReqKeys<F extends Fields> = {
	[K in DataKeys<F>]: F[K] extends { readonly '~req'?: true } ? K : never;
}[DataKeys<F>];
type InReqKeys<F extends Fields> = {
	[K in DataKeys<F>]: F[K] extends { readonly '~opt'?: false } ? K : never;
}[DataKeys<F>];

/** Data contributed by layout fields (row/collapsible/tabs) whose children are hoisted. */
type LayoutOut<F extends Fields> = [LayoutKeys<F>] extends [never]
	? unknown
	: UnionToIntersection<{ [K in LayoutKeys<F>]: NonNullable<F[K]['~out']> }[LayoutKeys<F>]>;
type LayoutIn<F extends Fields> = [LayoutKeys<F>] extends [never]
	? unknown
	: UnionToIntersection<{ [K in LayoutKeys<F>]: NonNullable<F[K]['~in']> }[LayoutKeys<F>]>;

/**
 * Fields → stored (read) data. Required fields are non-null. Everything else is optional and
 * nullable. Layout fields contribute their children's data.
 */
export type InferFields<F extends Fields> = Simplify<
	{ [K in ReqKeys<F>]: NonNullable<F[K]['~out']> } & {
		[K in Exclude<DataKeys<F>, ReqKeys<F>>]?: F[K]['~out'] | null;
	} & LayoutOut<F>
>;

/**
 * Fields → create input. A key is required only when the field is required and has no default.
 * Relationship ids are plain strings and nested row/block ids are optional.
 */
export type InferInput<F extends Fields> = Simplify<
	{ [K in InReqKeys<F>]: NonNullable<F[K]['~in']> } & {
		[K in Exclude<DataKeys<F>, InReqKeys<F>>]?: F[K]['~in'] | null;
	} & LayoutIn<F>
>;

/** The stored shape of one block from a block union. */
export type BlockDoc<B extends BlockDef> = B extends BlockDef ? NonNullable<B['~doc']> : never;
/** The input shape of one block from a block union. */
export type BlockInput<B extends BlockDef> = B extends BlockDef ? NonNullable<B['~in']> : never;

/** Input type of a field definition. */
export type FieldIn<F extends FieldDef> = NonNullable<F['~in']>;
