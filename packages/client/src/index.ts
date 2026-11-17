// @kitcms/client: a typed wrapper for Workers that call a kitcms Service Binding (RPC entrypoint
// `KitcmsRPC`, see @kitcms/core/rpc). Workers-safe, zero runtime dependencies.
//
//   import { kitcms } from '@kitcms/client';
//   import type { KitcmsTypes } from './kitcms-types'; // from `kitcms generate:types`
//   const cms = kitcms<KitcmsTypes>(env.CMS);
//   const { docs } = await cms.find('posts', { where: { status: { equals: 'published' } }, depth: 1 });

export const VERSION = '0.0.0';

// ---------------------------------------------------------------------------------------------
// Types (self-contained mirrors of @kitcms/core's in-app typing)
// ---------------------------------------------------------------------------------------------

/** A relationship value before population: the target's id, branded with the target slug. */
export type Rel<To extends string> = string & { readonly '~rel': To };

/** The shape `kitcms generate:types` emits as `KitcmsTypes`. */
export interface KitcmsTypes {
	collections: Record<string, object>;
	/** Globals (single documents). Absent in configs without globals. */
	globals?: Record<string, object>;
	/** Create/update input shapes per collection (optional: falls back to a partial document). */
	inputs?: Record<string, object>;
}

/** Every document has these. */
export interface SystemFields {
	id: string;
	createdAt: string;
	updatedAt: string;
	/** Orderable collections only: the read-only fractional order key. */
	_order?: string | null;
}
/** Used when `kitcms()` is called without a type argument. */
export type GenericDoc = Record<string, unknown> & SystemFields;
export interface GenericTypes {
	collections: Record<string, GenericDoc>;
	globals: Record<string, Record<string, unknown> & { id: string }>;
}

/** How many levels of relationships to load. 0 (the default) returns ids. Max 2. */
export type Depth = 0 | 1 | 2;

type Prev = [never, 0, 1, 2];
/**
 * Replaces relationship ids with documents, `D` levels deep. A target that is missing or not
 * readable by the caller stays an id, hence `| string`.
 */
export type Populate<T, Types extends KitcmsTypes, D extends number> = [D] extends [0]
	? T
	: T extends Rel<infer To>
		? To extends keyof Types['collections']
			? Populate<Types['collections'][To], Types, Prev[D]> | string
			: string
		: T extends readonly (infer E)[]
			? Populate<E, Types, D>[]
			: T extends object
				? { [K in keyof T]: Populate<T[K], Types, D> }
				: T;

type Scalar = string | number | boolean;
type Range<V> = {
	greater_than?: V;
	greater_than_equal?: V;
	less_than?: V;
	less_than_equal?: V;
};
type WhereValue<V> = V extends Rel<string> ? string : V;

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

type Filterable<V> = V extends Scalar ? true : V extends readonly Rel<string>[] ? true : false;

/** The untyped form of a filter. */
export interface WhereInput {
	and?: WhereInput[];
	or?: WhereInput[];
	[field: string]: Record<string, unknown> | WhereInput[] | undefined;
}

/** A typed filter over a document's top-level filterable fields. Untyped docs take `WhereInput`. */
export type Where<Doc> = string extends keyof Doc ? WhereInput : TypedWhere<Doc>;
type TypedWhere<Doc> = {
	[K in keyof Doc as Filterable<NonNullable<Doc[K]>> extends true ? K : never]?: WhereOps<NonNullable<Doc[K]>>;
} & { and?: TypedWhere<Doc>[]; or?: TypedWhere<Doc>[] };

/** `'title'` ascending, `'-title'` descending. */
export type Sort<Doc> = `${'-' | ''}${keyof Doc & string}`;

export interface PaginatedDocs<T> {
	docs: T[];
	totalDocs: number;
	limit: number;
	page: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

/** `'system'`: trusted caller, reads skip access rules. Default: anonymous. Use only from Workers you control. */
export interface CallerOptions {
	as?: 'system';
}

/** Drafts are only readable by trusted callers: `draft: true` requires `as: 'system'`. */
export type DraftRead = { draft?: false; as?: 'system' } | { draft: true; as: 'system' };

export interface FindArgs<Doc, D extends Depth> extends CallerOptions {
	where?: Where<Doc>;
	sort?: Sort<Doc>;
	/** Page size. Default 10, max 1000. */
	limit?: number;
	/** 1-based. Default 1. */
	page?: number;
	depth?: D;
	/** `false` skips the total count. Default `true`. */
	pagination?: boolean;
}

export interface ReadOptions<D extends Depth> extends CallerOptions {
	depth?: D;
}

/** Options of every write. Writes over RPC are for trusted callers only (`as: 'system'`). */
export interface WriteOptions<D extends Depth> {
	as: 'system';
	depth?: D;
	/** Save as a draft (collections/globals with drafts). */
	draft?: boolean;
}

/** Where to put a document of an orderable collection. */
export type MoveTarget = { before: string; after?: never } | { after: string; before?: never };

/** The RPC stub: structurally, a `Service<KitcmsRPCMethods>` binding (`env.CMS`). */
export interface KitcmsBinding {
	find(collection: string, options?: object): Promise<unknown>;
	findOne(collection: string, options?: object): Promise<unknown>;
	findByID(collection: string, id: string, options?: object): Promise<unknown>;
	count(collection: string, options?: object): Promise<number>;
	findGlobal(global: string, options?: object): Promise<unknown>;
	getMediaUrl(key: string): Promise<string | null>;
	create(collection: string, data: object, options: object): Promise<unknown>;
	update(collection: string, id: string, data: object, options: object): Promise<unknown>;
	delete(collection: string, id: string, options: object): Promise<unknown>;
	move(collection: string, id: string, target: object, options: object): Promise<unknown>;
	unpublish(collection: string, id: string, options: object): Promise<unknown>;
	updateGlobal(global: string, data: object, options: object): Promise<unknown>;
}

type DocOf<T extends KitcmsTypes, S extends keyof T['collections']> = T['collections'][S];
type GlobalsOf<T extends KitcmsTypes> = NonNullable<T['globals']>;
type InputOf<T extends KitcmsTypes, S extends string> =
	NonNullable<T['inputs']> extends infer I ? (S extends keyof I ? I[S] : Partial<DocOf<T, S>>) : never;
/** Write input: relationship ids are plain strings. */
type WritableValue<V> = V extends Rel<string> ? string : V extends readonly Rel<string>[] ? string[] : V;
type Writable<T> = { [K in keyof T]?: WritableValue<T[K]> };

export interface KitcmsClient<T extends KitcmsTypes = GenericTypes> {
	find<S extends keyof T['collections'] & string, D extends Depth = 0>(
		collection: S,
		args?: Omit<FindArgs<DocOf<T, S>, D>, 'as'> & DraftRead,
	): Promise<PaginatedDocs<Populate<DocOf<T, S>, T, D>>>;

	/** The first match, or `null`. */
	findOne<S extends keyof T['collections'] & string, D extends Depth = 0>(
		collection: S,
		args?: Omit<FindArgs<DocOf<T, S>, D>, 'limit' | 'page' | 'pagination' | 'as'> & DraftRead,
	): Promise<Populate<DocOf<T, S>, T, D> | null>;

	/** `null` when the document doesn't exist or the caller may not read it. */
	findByID<S extends keyof T['collections'] & string, D extends Depth = 0>(
		collection: S,
		id: string,
		args?: Omit<ReadOptions<D>, 'as'> & DraftRead,
	): Promise<Populate<DocOf<T, S>, T, D> | null>;

	/** A global. An unsaved global returns its defaults. */
	findGlobal<S extends keyof GlobalsOf<T> & string, D extends Depth = 0>(
		global: S,
		args?: Omit<ReadOptions<D>, 'as'> & DraftRead,
	): Promise<Populate<GlobalsOf<T>[S], T, D>>;

	/** Trusted callers only. Throws `FORBIDDEN` without `as: 'system'`. */
	create<S extends keyof T['collections'] & string, D extends Depth = 0>(
		collection: S,
		data: InputOf<T, S> | Writable<DocOf<T, S>>,
		options: WriteOptions<D>,
	): Promise<Populate<DocOf<T, S>, T, D>>;

	/** Partial update. Trusted callers only. */
	update<S extends keyof T['collections'] & string, D extends Depth = 0>(
		collection: S,
		id: string,
		data: Partial<InputOf<T, S>> | Writable<DocOf<T, S>>,
		options: WriteOptions<D>,
	): Promise<Populate<DocOf<T, S>, T, D>>;

	/** Trusted callers only. Returns the deleted document. */
	delete<S extends keyof T['collections'] & string>(
		collection: S,
		id: string,
		options: { as: 'system' },
	): Promise<DocOf<T, S>>;

	/** Orderable collections: place a document before/after another. Trusted callers only. */
	move<S extends keyof T['collections'] & string>(
		collection: S,
		id: string,
		target: MoveTarget,
		options: { as: 'system' },
	): Promise<DocOf<T, S>>;

	/** Drafts: take a published document offline. Trusted callers only. */
	unpublish<S extends keyof T['collections'] & string>(
		collection: S,
		id: string,
		options: { as: 'system' },
	): Promise<DocOf<T, S>>;

	/** Partial update of a global. Trusted callers only. */
	updateGlobal<S extends keyof GlobalsOf<T> & string, D extends Depth = 0>(
		global: S,
		data: Writable<GlobalsOf<T>[S]>,
		options: WriteOptions<D>,
	): Promise<Populate<GlobalsOf<T>[S], T, D>>;

	count<S extends keyof T['collections'] & string>(
		collection: S,
		args?: { where?: Where<DocOf<T, S>> } & CallerOptions,
	): Promise<number>;

	/** The public URL for an R2 key, or `null` when none is configured. */
	getMediaUrl(key: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

/** A kitcms error that crossed the Service Binding. `code` and `status` mirror core's `KitcmsError`. */
export class KitcmsClientError extends Error {
	readonly code: string;
	readonly status: number;
	constructor(code: string, status: number, message: string) {
		super(message);
		this.name = 'KitcmsClientError';
		this.code = code;
		this.status = status;
	}
}

export function isKitcmsClientError(err: unknown): err is KitcmsClientError {
	return err instanceof KitcmsClientError;
}

const WIRE = /kitcms:([A-Za-z_]+):(\d{3}): ([\s\S]*)$/;

/** Turns `kitcms:<CODE>:<status>: <message>` into a `KitcmsClientError`; anything else is returned as-is. */
export function parseKitcmsError(err: unknown): unknown {
	if (err instanceof KitcmsClientError) return err;
	const message = typeof err === 'object' && err !== null ? (err as { message?: unknown }).message : undefined;
	if (typeof message !== 'string') return err;
	const m = WIRE.exec(message);
	if (!m) return err;
	const out = new KitcmsClientError(m[1]!, Number(m[2]), m[3]!);
	if (err instanceof Error && err.stack) out.cause = err;
	return out;
}

// ---------------------------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------------------------

/** Wraps a kitcms Service Binding. Pass the generated `KitcmsTypes` for typed collections. */
export function kitcms<T extends KitcmsTypes = GenericTypes>(binding: KitcmsBinding): KitcmsClient<T> {
	async function call<R>(fn: () => Promise<R>): Promise<R> {
		try {
			return await fn();
		} catch (e) {
			throw parseKitcmsError(e);
		}
	}
	// Options are forwarded untouched; the server whitelists and validates them.
	return {
		find: (collection, args) => call(() => binding.find(collection, args) as Promise<never>),
		findOne: (collection, args) => call(() => binding.findOne(collection, args) as Promise<never>),
		findByID: (collection, id, args) => call(() => binding.findByID(collection, id, args) as Promise<never>),
		count: (collection, args) => call(() => binding.count(collection, args)),
		findGlobal: (global, args) => call(() => binding.findGlobal(global, args) as Promise<never>),
		getMediaUrl: (key) => call(() => binding.getMediaUrl(key)),
		create: (collection, data, options) => call(() => binding.create(collection, data, options) as Promise<never>),
		update: (collection, id, data, options) =>
			call(() => binding.update(collection, id, data, options) as Promise<never>),
		delete: (collection, id, options) => call(() => binding.delete(collection, id, options) as Promise<never>),
		move: (collection, id, target, options) =>
			call(() => binding.move(collection, id, target, options) as Promise<never>),
		unpublish: (collection, id, options) => call(() => binding.unpublish(collection, id, options) as Promise<never>),
		updateGlobal: (global, data, options) =>
			call(() => binding.updateGlobal(global, data, options) as Promise<never>),
	};
}
