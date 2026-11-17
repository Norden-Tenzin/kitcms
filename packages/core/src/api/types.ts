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
	GenericGlobalDoc,
	GenericInput,
	GlobalDocOf as GlobalDocOfRaw,
	GlobalInputOf as GlobalInputOfRaw,
	GlobalSlug,
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

type IsWideGlobal<C extends Config> = string extends GlobalSlug<C> ? true : false;
/** The document type of global `S`. */
export type GlobalDocOf<C extends Config, S extends string> =
	IsWideGlobal<C> extends true ? GenericGlobalDoc : GlobalDocOfRaw<C, S>;
export type GlobalInputOf<C extends Config, S extends string> =
	IsWideGlobal<C> extends true ? GenericInput : GlobalInputOfRaw<C, S>;

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

/** Reads of collections/globals with drafts (§13.4). */
export interface DraftReadOption {
	/**
	 * `true`: return the latest draft when it is newer than the published document, and include
	 * unpublished documents. Default: published documents only. Ignored without drafts.
	 */
	draft?: boolean;
}

/** Writes of collections/globals with drafts (§13.4). */
export interface DraftWriteOption {
	/**
	 * `true`: save as a draft (published content is untouched; `required`/`minRows` not enforced).
	 * Default: publish. Ignored without drafts.
	 */
	draft?: boolean;
	/** Admin autosave: update the latest autosave version in place instead of adding one. */
	autosave?: boolean;
}

export interface FindArgs<Doc, D extends Depth> extends OperationOptions, DraftReadOption {
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

export interface ReadOptions<D extends Depth> extends OperationOptions, DraftReadOption {
	depth?: D;
}

export interface WriteOptions<D extends Depth> extends OperationOptions, DraftWriteOption {
	/** Depth of the returned document. */
	depth?: D;
}

/** Where to put a document of an orderable collection (§13.2). Exactly one key. */
export type MoveTarget = { before: string; after?: never } | { after: string; before?: never };

/** One stored version (§13.4). `version` holds the document data (no system fields). */
export interface VersionDoc<Doc> {
	id: string;
	/** The document id (for globals: the global slug). */
	parent: string;
	version: Doc;
	/** Collections/globals with drafts only. */
	_status?: 'draft' | 'published';
	autosave: boolean;
	/** The newest version of its document. */
	latest: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface FindVersionsArgs extends OperationOptions {
	/** Page size. Default 10, max 100. Newest first. */
	limit?: number;
	page?: number;
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
		args?: { where?: Where<DocOf<C, S>> } & OperationOptions & DraftReadOption,
	): Promise<number>;

	/** Throws `ValidationError` (with field errors) or `ForbiddenError`. */
	create<S extends CollectionSlug<C>, D extends Depth = 0>(
		collection: S,
		data: InputOf<C, S>,
		options?: WriteOptions<D>,
	): Promise<Populate<DocOf<C, S>, C, D>>;

	/** Partial update. Throws `NotFoundError`, `ValidationError` or `ForbiddenError`. */
	update<S extends CollectionSlug<C>, D extends Depth = 0>(
		collection: S,
		id: string,
		data: Partial<InputOf<C, S>>,
		options?: WriteOptions<D>,
	): Promise<Populate<DocOf<C, S>, C, D>>;

	/**
	 * Orderable collections (§13.2): puts the document directly before/after another one.
	 * Runs as an update with no field changes (update access, hooks with `context.move = true`).
	 */
	move<S extends CollectionSlug<C>>(
		collection: S,
		id: string,
		target: MoveTarget,
		options?: OperationOptions,
	): Promise<DocOf<C, S>>;

	/** Drafts (§13.4): takes a published document offline (`_status = 'draft'`), keeping its data. */
	unpublish<S extends CollectionSlug<C>>(
		collection: S,
		id: string,
		options?: OperationOptions,
	): Promise<DocOf<C, S>>;

	/** Versions of one document, newest first. Needs read AND update access to the document. */
	findVersions<S extends CollectionSlug<C>>(
		collection: S,
		id: string,
		args?: FindVersionsArgs,
	): Promise<PaginatedDocs<VersionDoc<DocOf<C, S>>>>;

	findVersionByID<S extends CollectionSlug<C>>(
		collection: S,
		versionId: string,
		options?: OperationOptions,
	): Promise<VersionDoc<DocOf<C, S>> | null>;

	/** Writes a version's data back as an update (as a draft with `{ draft: true }`). */
	restoreVersion<S extends CollectionSlug<C>, D extends Depth = 0>(
		collection: S,
		versionId: string,
		options?: WriteOptions<D>,
	): Promise<Populate<DocOf<C, S>, C, D>>;

	/** A global (§13.1). Never `null`: an unsaved global returns its defaults. */
	findGlobal<S extends GlobalSlug<C>, D extends Depth = 0>(
		global: S,
		options?: ReadOptions<D>,
	): Promise<Populate<GlobalDocOf<C, S>, C, D>>;

	/** Partial update of a global (creates its row on the first save). */
	updateGlobal<S extends GlobalSlug<C>, D extends Depth = 0>(
		global: S,
		data: Partial<GlobalInputOf<C, S>>,
		options?: WriteOptions<D>,
	): Promise<Populate<GlobalDocOf<C, S>, C, D>>;

	findGlobalVersions<S extends GlobalSlug<C>>(
		global: S,
		args?: FindVersionsArgs,
	): Promise<PaginatedDocs<VersionDoc<GlobalDocOf<C, S>>>>;

	restoreGlobalVersion<S extends GlobalSlug<C>, D extends Depth = 0>(
		global: S,
		versionId: string,
		options?: WriteOptions<D>,
	): Promise<Populate<GlobalDocOf<C, S>, C, D>>;

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
