// SPIKE (Phase 0, type inference): prototype of the defineConfig / fields / Local API types.
// Principle: compute each document type ONCE, at the builder call (field(), block(), collection()),
// and store it in a phantom `~out` / `~doc` property. Lookups (find('pages')) are then indexed
// accesses, not re-derivations over the whole config. Only relationship population (depth > 0)
// needs a deep map, and that's what the stress test measures.

// ---------- relationship markers ----------
/**
 * Stored type of a relationship value before population: the target's id, branded with the target
 * slug. The brand is REQUIRED (an optional brand would make every string match `Rel<infer To>`).
 * Branded ids are still assignable to `string`, so depth-0 reads need no mapping.
 */
export type Rel<To extends string> = string & { readonly '~rel': To };

/** Write-side type: relationship ids are plain strings. Only used for create/update input. */
export type Input<T> =
	T extends Rel<string>
		? string
		: T extends Date
			? T
			: T extends readonly (infer E)[]
				? Input<E>[]
				: T extends object
					? { [K in keyof T]: Input<T[K]> }
					: T;

// ---------- fields ----------
interface FieldCommon<R extends boolean> {
	required?: R;
	admin?: { description?: string; readOnly?: boolean; hidden?: boolean };
}

export interface Field<Type extends string = string, Out = unknown, R extends boolean = boolean> {
	readonly type: Type;
	readonly required?: R;
	/** Phantom: the stored value type. Never set at runtime. */
	readonly '~out'?: Out;
}

export type Fields = Record<string, Field>;

type RequiredKeys<F extends Fields> = {
	[K in keyof F]: F[K] extends Field<string, unknown, true> ? K : never;
}[keyof F];

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Fields → stored data. Required fields are non-null, everything else is `T | null` and optional. */
export type InferFields<F extends Fields> = Simplify<
	{ [K in RequiredKeys<F>]: NonNullable<F[K]['~out']> } & {
		[K in Exclude<keyof F, RequiredKeys<F>>]?: F[K]['~out'] | null;
	}
>;

// NoInfer<R>: builders are called inside `fields: {...}`, whose contextual type (`Field<…, boolean>`)
// would otherwise flow into the builder's return type and widen `required: true` to `boolean`.
const mk = <T extends string, O, R extends boolean>(
	type: T,
	opts: object,
): Field<T, O, NoInfer<R>> => ({ type, ...opts }) as Field<T, O, R>;

export interface BlockDef<Slug extends string = string, Doc = unknown> {
	readonly slug: Slug;
	readonly fields: Fields;
	readonly '~doc'?: Doc;
}

export const f = {
	text: <R extends boolean = false>(o: FieldCommon<R> & { unique?: boolean } = {}) =>
		mk<'text', string, R>('text', o),
	textarea: <R extends boolean = false>(o: FieldCommon<R> = {}) =>
		mk<'textarea', string, R>('textarea', o),
	email: <R extends boolean = false>(o: FieldCommon<R> = {}) => mk<'email', string, R>('email', o),
	slug: <R extends boolean = false>(o: FieldCommon<R> & { from?: string; unique?: boolean } = {}) =>
		mk<'slug', string, R>('slug', o),
	number: <R extends boolean = false>(o: FieldCommon<R> = {}) =>
		mk<'number', number, R>('number', o),
	checkbox: (o: { defaultValue?: boolean } = {}) => mk<'checkbox', boolean, true>('checkbox', o),
	date: <R extends boolean = false>(o: FieldCommon<R> = {}) => mk<'date', Date, R>('date', o),
	select: <const O extends readonly string[], R extends boolean = false>(
		o: FieldCommon<R> & { options: O },
	) => mk<'select', O[number], R>('select', o),
	json: <T = unknown>(o: FieldCommon<false> = {}) => mk<'json', T, false>('json', o),
	richText: (o: FieldCommon<false> = {}) =>
		mk<'richText', { type: 'doc'; content: unknown[] }, false>('richText', o),
	relationship: <const To extends string, M extends boolean = false, R extends boolean = false>(
		o: FieldCommon<R> & { relationTo: To; hasMany?: M },
	) => mk<'relationship', M extends true ? Rel<To>[] : Rel<To>, R>('relationship', o),
	upload: <const To extends string, R extends boolean = false>(
		o: FieldCommon<R> & { relationTo: To },
	) => mk<'upload', Rel<To>, R>('upload', o),
	group: <F extends Fields>(o: { fields: F }) => mk<'group', InferFields<F>, true>('group', o),
	array: <F extends Fields>(o: { fields: F; minRows?: number; maxRows?: number }) =>
		mk<'array', Array<{ id: string } & InferFields<F>>, true>('array', o),
	blocks: <const B extends readonly BlockDef[]>(o: {
		blocks: B;
		minRows?: number;
		maxRows?: number;
	}) => mk<'blocks', Array<NonNullable<B[number]['~doc']>>, true>('blocks', o),
};

export function block<const Slug extends string, F extends Fields>(def: {
	slug: Slug;
	fields: F;
	admin?: { preview?: unknown };
}): BlockDef<Slug, Simplify<{ id: string; blockType: Slug } & InferFields<F>>> {
	return def;
}

// ---------- collections & config ----------
export interface CollectionDef<Slug extends string = string, Doc = unknown> {
	readonly slug: Slug;
	readonly fields: Fields;
	readonly '~doc'?: Doc;
}

type SystemFields = { id: string; createdAt: Date; updatedAt: Date };

export function collection<const Slug extends string, F extends Fields>(def: {
	slug: Slug;
	fields: F;
	admin?: { useAsTitle?: keyof F & string; orderable?: boolean; locked?: boolean };
	versions?: { drafts?: boolean };
	upload?: boolean;
}): CollectionDef<Slug, Simplify<SystemFields & InferFields<F>>> {
	return def;
}

export interface Config<C extends readonly CollectionDef[] = readonly CollectionDef[]> {
	collections: C;
}

export function defineConfig<const C extends readonly CollectionDef[]>(config: {
	collections: C;
}): Config<C> {
	return config;
}

// ---------- Local API types ----------
type Collections<C extends Config> = C['collections'][number];
export type CollectionSlug<C extends Config> = Collections<C>['slug'];
export type DocOf<C extends Config, S extends CollectionSlug<C>> = NonNullable<
	Extract<Collections<C>, { slug: S }>['~doc']
>;

type Prev = [never, 0, 1, 2];
/**
 * Replaces Rel<To> markers with populated docs, `D` levels deep. D = 0 returns T unchanged (ids).
 * This deep map over nested JSON is the only expensive type in the system.
 */
export type Populate<T, C extends Config, D extends number> = [D] extends [0]
	? T
	: T extends Rel<infer To>
		? To extends CollectionSlug<C>
			? Populate<DocOf<C, To>, C, Prev[D]> | string
			: string
		: T extends Date
			? T
			: T extends readonly (infer E)[]
				? Populate<E, C, D>[]
				: T extends object
					? { [K in keyof T]: Populate<T[K], C, D> }
					: T;

// `where` only covers top-level scalar fields (nested JSON can't be filtered in v1, see §4.3).
type Scalar = string | number | boolean | Date;
type Ops<V> = {
	equals?: V;
	not_equals?: V;
	in?: V[];
	not_in?: V[];
	exists?: boolean;
} & (V extends number | Date
	? { greater_than?: V; less_than?: V }
	: V extends string
		? { like?: string }
		: unknown);
export type Where<Doc> = {
	[K in keyof Doc as NonNullable<Doc[K]> extends Scalar ? K : never]?: Ops<NonNullable<Doc[K]>>;
} & { and?: Where<Doc>[]; or?: Where<Doc>[] };

export interface FindArgs<Doc, D extends number> {
	where?: Where<Doc>;
	sort?: `${'-' | ''}${keyof Doc & string}`;
	limit?: number;
	page?: number;
	depth?: D;
}

export interface LocalAPI<C extends Config> {
	find<S extends CollectionSlug<C>, D extends 0 | 1 | 2 = 0>(
		collection: S,
		args?: FindArgs<DocOf<C, S>, D>,
	): Promise<{ docs: Populate<DocOf<C, S>, C, D>[]; totalDocs: number }>;
	findByID<S extends CollectionSlug<C>, D extends 0 | 1 | 2 = 0>(
		collection: S,
		id: string,
		args?: { depth?: D },
	): Promise<Populate<DocOf<C, S>, C, D> | null>;
	create<S extends CollectionSlug<C>>(
		collection: S,
		data: Input<Omit<DocOf<C, S>, 'id' | 'createdAt' | 'updatedAt'>>,
	): Promise<DocOf<C, S>>;
}
