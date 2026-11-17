// The Local API surface (plan §4.3). One pipeline serves the Local API, RPC, REST and the admin:
// access → hooks → validate → D1 → hooks.
//
// `LocalAPI<C>` is the typed facade the app sees (`locals.cms`, with the registered config).
// `Cms` is the same object typed against the untyped config: package code (admin, RPC, REST)
// must use `Cms`, never the registered types, because package sources are type-checked inside
// the app's program where `Register` is augmented.

import type {
	CollectionSlug,
	Config,
	DocOf as DocOfRaw,
	GenericDoc,
	GenericInput,
	InputOf as InputOfRaw,
	RegisteredConfig,
} from '../config/collection';
import type { KitcmsReq } from '../config/hooks';
import type { Rel } from '../config/infer';
import type { Sort, Where } from '../config/where';

/** How many levels of relationships to load. 0 (the default) returns ids. Max 2. */
export type Depth = 0 | 1 | 2;

type IsWide<S extends string> = string extends S ? true : false;
/** The stored document type of collection `S`. Falls back to `GenericDoc` for untyped configs. */
export type DocOf<C extends Config, S extends string> =
	IsWide<CollectionSlug<C>> extends true ? GenericDoc : DocOfRaw<C, S>;
export type InputOf<C extends Config, S extends string> =
	IsWide<CollectionSlug<C>> extends true ? GenericInput : InputOfRaw<C, S>;

type Prev = [never, 0, 1, 2];
/**
 * Replaces relationship ids with documents, `D` levels deep. D = 0 returns T unchanged.
 * A target that is missing or not readable by the caller stays an id, hence `| string`.
 */
export type Populate<T, C extends Config, D extends number> = [D] extends [0]
	? T
	: T extends Rel<infer To>
		? To extends CollectionSlug<C>
			? Populate<DocOf<C, To>, C, Prev[D]> | string
			: string
		: T extends readonly (infer E)[]
			? Populate<E, C, D>[]
			: T extends object
				? { [K in keyof T]: Populate<T[K], C, D> }
				: T;

/** Options every operation accepts. */
export interface OperationOptions {
	/**
	 * Skip collection and field access rules (hooks and validation still run). Use for trusted
	 * server code such as seeding or scheduled jobs. Never pass it based on client input.
	 */
	overrideAccess?: boolean;
	/** Share the calling operation's `req` (user and `context`), from inside a hook. */
	req?: KitcmsReq;
	/** Merged into `req.context` for this operation's hooks. */
	context?: Record<string, unknown>;
}

export interface FindArgs<Doc, D extends Depth> extends OperationOptions {
	where?: Where<Doc>;
	/** Default: the collection's `defaultSort`, else `'-createdAt'`. Ties break on `id`. */
	sort?: Sort<Doc>;
	/** Page size. Default 10, max 1000. */
	limit?: number;
	/** 1-based. Default 1. */
	page?: number;
	depth?: D;
	/** `false` skips the total count (no `totalDocs`/`totalPages`). Default `true`. */
	pagination?: boolean;
}

export interface PaginatedDocs<T> {
	docs: T[];
	totalDocs: number;
	limit: number;
	page: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface ReadOptions<D extends Depth> extends OperationOptions {
	depth?: D;
}

/**
 * The Local API. In the app: `locals.cms`, acting as the request's user (anonymous on public
 * routes). Every method runs the full pipeline.
 */
export interface LocalAPI<C extends Config = RegisteredConfig> {
	find<S extends CollectionSlug<C>, D extends Depth = 0>(
		collection: S,
		args?: FindArgs<DocOf<C, S>, D>,
	): Promise<PaginatedDocs<Populate<DocOf<C, S>, C, D>>>;

	/** The first match, or `null`. */
	findOne<S extends CollectionSlug<C>, D extends Depth = 0>(
		collection: S,
		args?: Omit<FindArgs<DocOf<C, S>, D>, 'limit' | 'page' | 'pagination'>,
	): Promise<Populate<DocOf<C, S>, C, D> | null>;

	/** `null` when the document doesn't exist or the caller may not read it. */
	findByID<S extends CollectionSlug<C>, D extends Depth = 0>(
		collection: S,
		id: string,
		args?: ReadOptions<D>,
	): Promise<Populate<DocOf<C, S>, C, D> | null>;

	count<S extends CollectionSlug<C>>(
		collection: S,
		args?: { where?: Where<DocOf<C, S>> } & OperationOptions,
	): Promise<number>;

	/** Throws `ValidationError` (with field errors) or `ForbiddenError`. */
	create<S extends CollectionSlug<C>, D extends Depth = 0>(
		collection: S,
		data: InputOf<C, S>,
		options?: ReadOptions<D>,
	): Promise<Populate<DocOf<C, S>, C, D>>;

	/** Partial update. Throws `NotFoundError`, `ValidationError` or `ForbiddenError`. */
	update<S extends CollectionSlug<C>, D extends Depth = 0>(
		collection: S,
		id: string,
		data: Partial<InputOf<C, S>>,
		options?: ReadOptions<D>,
	): Promise<Populate<DocOf<C, S>, C, D>>;

	/**
	 * Returns the deleted document. Throws `NotFoundError`, `ForbiddenError`, or
	 * `ReferencedError` while other documents still reference it (see `_refs`).
	 */
	delete<S extends CollectionSlug<C>>(
		collection: S,
		id: string,
		options?: OperationOptions,
	): Promise<DocOf<C, S>>;
}

/** The Local API typed against the untyped config. What package code uses. */
export type Cms = LocalAPI<Config>;
