// Field definitions and the `fields` builders (`fields.text()`, `fields.blocks()`, ...).
//
// Type inference rules (from the Phase 0 spike, plan §4.4):
// 1. Compute once, at the builder call. Each builder records its value type in the phantom
//    `'~out'` property, so documents are derived by indexed lookups, never by re-walking the config.
// 2. `NoInfer<R>` in builder return types. Builders are called inside `fields: {...}`, whose
//    contextual type would otherwise widen `required: true` to `boolean`.
// 3. Relationships are branded ids (`Rel<To>`), see ./infer.ts.
//
// Runtime: a builder returns a plain object `{ type, ...options }`. Phantom properties never exist
// at runtime. Field names come from the keys of the `fields` record.

import type { FieldAccess, FieldHooks, FieldValidate } from './hooks';
import type { BlockDoc, BlockInput, InferFields, InferInput, Rel, RichTextDoc } from './infer';

// ---------------------------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------------------------

/** Every field type kitcms supports in v1 (§4.5). */
export type FieldType = DataFieldType | LayoutFieldType;

export type DataFieldType =
	| 'text'
	| 'textarea'
	| 'email'
	| 'slug'
	| 'number'
	| 'checkbox'
	| 'select'
	| 'date'
	| 'richText'
	| 'json'
	| 'relationship'
	| 'upload'
	| 'group'
	| 'array'
	| 'blocks';

/** Layout-only fields: they hold no data. Their child fields are stored as if declared next to them. */
export type LayoutFieldType = 'row' | 'collapsible' | 'tabs';

/**
 * Base shape of every field definition.
 * - `Out`: the stored (read) value type.
 * - `R`: whether the field is required, i.e. never null on read.
 * - `Opt`: whether the field may be omitted on create (not required, or it has a default).
 */
export interface FieldDef<
	Type extends FieldType = FieldType,
	Out = unknown,
	R extends boolean = boolean,
	Opt extends boolean = boolean,
	In = Out,
> {
	readonly type: Type;
	/** Phantom: the stored value type. Never set at runtime. */
	readonly '~out'?: Out;
	/** Phantom: whether the value is non-null on read. */
	readonly '~req'?: R;
	/** Phantom: whether create input may omit the value. */
	readonly '~opt'?: Opt;
	/** Phantom: the create/update input type. */
	readonly '~in'?: In;
}

/** A record of named fields, as written in `collection({ fields: { ... } })`. */
export type Fields = Record<string, FieldDef>;

/** Admin presentation options shared by all data fields. */
export interface FieldAdmin {
	/** Help text shown under the input. */
	description?: string;
	/** Shown but never editable in the admin. Server-side writes still go through field access. */
	readOnly?: boolean;
	/** Not rendered in the admin at all. The value is still stored and returned. */
	hidden?: boolean;
	/** `sidebar` renders the field in the edit view's side column. */
	position?: 'main' | 'sidebar';
	/** CSS width inside a `row`, e.g. `'50%'`. */
	width?: string;
	placeholder?: string;
	/**
	 * Show the field only when this returns true. Evaluated on the server (Decision 19): on load and
	 * on every save round trip. A hidden field's value is kept, and its validation is skipped.
	 */
	condition?: (data: Record<string, unknown>, siblingData: Record<string, unknown>) => boolean;
}

/** Options shared by every data field. `T` is the field's value type. */
export interface FieldOptions<T> {
	/** Admin label. Defaults to the field name in sentence case. */
	label?: string;
	/** Must be present and non-empty. Required fields are non-null on read. */
	required?: boolean;
	/** Used on create when the input omits the field. A function is called per create. */
	defaultValue?: T | (() => T);
	/**
	 * Custom validation, on the server only (built-in rules also run in the browser, Decision 19).
	 * Return `true` (or nothing) when valid, or an error message.
	 */
	validate?: FieldValidate<T>;
	/** Field-level access (boolean only, no `where`). Denied reads drop the field, denied writes keep the old value. */
	access?: FieldAccess;
	hooks?: FieldHooks<T>;
	admin?: FieldAdmin;
}

/** Column options for fields stored as real columns. */
export interface ColumnOptions {
	/** Adds a database index. */
	index?: boolean;
	/** Adds a unique index. Duplicate values fail with a field error. */
	unique?: boolean;
}

export interface TextFieldOptions extends FieldOptions<string>, ColumnOptions {
	minLength?: number;
	maxLength?: number;
}
export interface TextareaFieldOptions extends FieldOptions<string> {
	minLength?: number;
	maxLength?: number;
	admin?: FieldAdmin & { rows?: number };
}
export interface EmailFieldOptions extends FieldOptions<string>, ColumnOptions {}
export interface SlugFieldOptions extends FieldOptions<string>, ColumnOptions {
	/** Name of a sibling field to derive the slug from when the input leaves it empty. */
	from?: string;
}
export interface NumberFieldOptions extends FieldOptions<number>, ColumnOptions {
	min?: number;
	max?: number;
	/** Only whole numbers are valid. */
	integer?: boolean;
	admin?: FieldAdmin & { step?: number };
}
export interface CheckboxFieldOptions extends Omit<FieldOptions<boolean>, 'required'> {
	/** Defaults to `false`. A checkbox is never null. */
	defaultValue?: boolean;
	index?: boolean;
}
export type SelectOption<V extends string = string> = V | { label: string; value: V };
export interface SelectFieldOptions<V extends string = string>
	extends FieldOptions<V>, ColumnOptions {
	options: readonly SelectOption<V>[];
}
export interface DateFieldOptions extends FieldOptions<string>, ColumnOptions {
	admin?: FieldAdmin & { picker?: 'day' | 'dayAndTime' };
}
export type RichTextFieldOptions = FieldOptions<RichTextDoc>;
export type JsonFieldOptions<T> = FieldOptions<T>;
export interface RelationshipFieldOptions<To extends string = string>
	extends FieldOptions<string | string[]> {
	/** Slug of the target collection. */
	relationTo: To;
	/** Store an ordered list of ids instead of one. */
	hasMany?: boolean;
	/** hasMany only. */
	minRows?: number;
	/** hasMany only. */
	maxRows?: number;
}
export interface GroupFieldOptions<F extends Fields>
	extends Omit<FieldOptions<InferFields<F>>, 'required' | 'defaultValue'> {
	fields: F;
}
export interface ArrayFieldOptions<F extends Fields>
	extends Omit<FieldOptions<unknown[]>, 'required' | 'defaultValue'> {
	fields: F;
	minRows?: number;
	maxRows?: number;
	/** Admin labels for one row / many rows. */
	labels?: { singular?: string; plural?: string };
}
export interface BlocksFieldOptions<B extends readonly BlockDef[]>
	extends Omit<FieldOptions<unknown[]>, 'required' | 'defaultValue'> {
	/** The only block types editors can add here (schema locking, §5). */
	blocks: B;
	minRows?: number;
	maxRows?: number;
	labels?: { singular?: string; plural?: string };
}

export interface RowFieldOptions<F extends Fields> {
	fields: F;
	admin?: { condition?: FieldAdmin['condition'] };
}
export interface CollapsibleFieldOptions<F extends Fields> {
	label: string;
	fields: F;
	admin?: { initCollapsed?: boolean; condition?: FieldAdmin['condition'] };
}
export interface Tab<F extends Fields = Fields> {
	label: string;
	description?: string;
	fields: F;
}

/** A layout field. `Out` is the data its child fields contribute to the surrounding object. */
export interface LayoutFieldDef<
	Type extends LayoutFieldType = LayoutFieldType,
	Out = unknown,
	In = unknown,
> extends FieldDef<Type, Out, true, true, In> {
	readonly '~layout': true;
}

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------

export interface BlockAdmin {
	/**
	 * Svelte component rendered by the inline live preview (Phase 2). It receives the block's
	 * current form values as props.
	 */
	preview?: unknown;
}

/** A block type, made with `block({ ... })`. `Doc` is the stored block shape. */
export interface BlockDef<Slug extends string = string, Doc = unknown> {
	readonly slug: Slug;
	readonly fields: Fields;
	readonly labels?: { singular?: string; plural?: string };
	readonly admin?: BlockAdmin;
	/** Phantom: the stored block shape. */
	readonly '~doc'?: Doc;
	/** Phantom: the block's input shape. */
	readonly '~in'?: unknown;
}

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------

type Data<T extends DataFieldType, Out, R extends boolean, Opt extends boolean, In = Out> = FieldDef<
	T,
	Out,
	NoInfer<R>,
	NoInfer<Opt>,
	In
>;

/** `required: true` in the options → non-null on read. */
type Req<O> = O extends { required: true } ? true : false;
/** Optional on create unless required without a default. */
type Opt<O> = O extends { required: true } ? (O extends { defaultValue: unknown } ? true : false) : true;
type Many<O> = O extends { hasMany: true } ? true : false;
type RelOut<To extends string, O> = Many<O> extends true ? Rel<To>[] : Rel<To>;
type RelIn<O> = Many<O> extends true ? string[] : string;
/** hasMany lists default to `[]`, so they are never null and may be omitted on create. */
type RelReq<O> = Many<O> extends true ? true : Req<O>;
type RelOpt<O> = Many<O> extends true ? true : Opt<O>;

/** Default for the inferred options type when no options are passed. */
type NoOptions = Record<never, never>;

const make = (type: FieldType, options: object): never => ({ ...options, type }) as never;
const layout = (type: LayoutFieldType, options: object): never =>
	({ ...options, type, '~layout': true }) as never;

/**
 * Field builders. Use as `fields.text({ required: true })`, usually imported as `fields as f`.
 * Field names are the keys of the record they are placed in.
 */
export const fields = {
	text: <const O extends TextFieldOptions = NoOptions>(
		options?: O & TextFieldOptions,
	): Data<'text', string, Req<O>, Opt<O>> => make('text', options ?? {}),

	textarea: <const O extends TextareaFieldOptions = NoOptions>(
		options?: O & TextareaFieldOptions,
	): Data<'textarea', string, Req<O>, Opt<O>> => make('textarea', options ?? {}),

	email: <const O extends EmailFieldOptions = NoOptions>(
		options?: O & EmailFieldOptions,
	): Data<'email', string, Req<O>, Opt<O>> => make('email', options ?? {}),

	/** A URL-safe string. With `from`, an empty input is filled from that sibling field. */
	slug: <const O extends SlugFieldOptions = NoOptions>(
		options?: O & SlugFieldOptions,
	): Data<'slug', string, Req<O>, O extends { from: string } ? true : Opt<O>> =>
		make('slug', options ?? {}),

	number: <const O extends NumberFieldOptions = NoOptions>(
		options?: O & NumberFieldOptions,
	): Data<'number', number, Req<O>, Opt<O>> => make('number', options ?? {}),

	/** Never null: defaults to `false`. */
	checkbox: (options?: CheckboxFieldOptions): Data<'checkbox', boolean, true, true> =>
		make('checkbox', options ?? {}),

	select: <const V extends string, const O extends Omit<SelectFieldOptions<V>, 'options'> = NoOptions>(
		options: O & SelectFieldOptions<V>,
	): Data<'select', V, Req<O>, Opt<O>> => make('select', options),

	/** Stored as an ISO 8601 string in documents (integer ms in the column, so it sorts and filters). */
	date: <const O extends DateFieldOptions = NoOptions>(
		options?: O & DateFieldOptions,
	): Data<'date', string, Req<O>, Opt<O>> => make('date', options ?? {}),

	/** Tiptap JSON (editor in Phase 2). Stored as one JSON column. */
	richText: <const O extends RichTextFieldOptions = NoOptions>(
		options?: O & RichTextFieldOptions,
	): Data<'richText', RichTextDoc, Req<O>, Opt<O>> => make('richText', options ?? {}),

	/** Arbitrary JSON. Pass the stored shape as a type argument: `fields.json<Hours>()`. Never required. */
	json: <T = unknown>(options?: Omit<JsonFieldOptions<T>, 'required'>): Data<'json', T, false, true> =>
		make('json', options ?? {}),

	relationship: <const To extends string, const O extends Omit<RelationshipFieldOptions, 'relationTo'> = NoOptions>(
		options: O & RelationshipFieldOptions<To>,
	): Data<'relationship', RelOut<To, O>, RelReq<O>, RelOpt<O>, RelIn<O>> => make('relationship', options),

	/** A relationship to an `upload: true` collection (media). */
	upload: <const To extends string, const O extends Omit<RelationshipFieldOptions, 'relationTo'> = NoOptions>(
		options: O & RelationshipFieldOptions<To>,
	): Data<'upload', RelOut<To, O>, RelReq<O>, RelOpt<O>, RelIn<O>> => make('upload', options),

	/** A named object of fields. Never null on read. Stored as one JSON column. */
	group: <F extends Fields>(
		options: GroupFieldOptions<F>,
	): Data<'group', InferFields<F>, true, true, InferInput<F>> => make('group', options),

	/** A list of rows with the same fields. Each row gets a stable `id`. Stored as one JSON column. */
	array: <F extends Fields>(
		options: ArrayFieldOptions<F>,
	): Data<
		'array',
		Array<{ id: string } & InferFields<F>>,
		true,
		true,
		Array<{ id?: string } & InferInput<F>>
	> => make('array', options),

	/** A list of blocks, limited to the given block types. Stored as one JSON column. */
	blocks: <const B extends readonly BlockDef[]>(
		options: BlocksFieldOptions<B>,
	): Data<'blocks', Array<BlockDoc<B[number]>>, true, true, Array<BlockInput<B[number]>>> =>
		make('blocks', options),

	/** Lays its fields out side by side. Its fields are stored as if declared next to it. */
	row: <F extends Fields>(
		options: RowFieldOptions<F>,
	): LayoutFieldDef<'row', InferFields<F>, InferInput<F>> => layout('row', options),

	/** A titled, collapsible section. Its fields are stored as if declared next to it. */
	collapsible: <F extends Fields>(
		options: CollapsibleFieldOptions<F>,
	): LayoutFieldDef<'collapsible', InferFields<F>, InferInput<F>> =>
		layout('collapsible', options),

	/** Tabs in the edit view. Their fields are stored as if declared next to them. */
	tabs: <const T extends readonly Tab[]>(options: {
		tabs: T;
	}): LayoutFieldDef<'tabs', TabsOut<T>, TabsIn<T>> => layout('tabs', options),
};

type TabsOut<T extends readonly Tab[]> = UnionToIntersection<
	{ [I in keyof T]: T[I] extends Tab<infer F> ? InferFields<F> : never }[number]
>;
type TabsIn<T extends readonly Tab[]> = UnionToIntersection<
	{ [I in keyof T]: T[I] extends Tab<infer F> ? InferInput<F> : never }[number]
>;

/** @internal */
export type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (
	i: infer I,
) => void
	? I
	: never;
