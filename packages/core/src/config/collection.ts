// `block()`, `collection()` and `defineConfig()`: the only place schema exists (principle 3).
// Each builder returns its input unchanged at runtime and computes the document types once.

import type { BlockAdmin, BlockDef, Fields } from './fields';
import type { CollectionAccess, CollectionHooks, KitcmsReq } from './hooks';
import type { InferFields, InferInput, Simplify } from './infer';
import type { TenancyOptions } from './tenancy';
import type { Sort } from './where';

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------

export interface BlockInputDef<Slug extends string, F extends Fields> {
	/** Stored as `blockType` on each block. Unique within one `blocks` field. */
	slug: Slug;
	fields: F;
	labels?: { singular?: string; plural?: string };
	admin?: BlockAdmin;
}

export interface TypedBlockDef<Slug extends string, Doc, In> extends BlockDef<Slug, Doc> {
	readonly '~in'?: In;
}

/** A block type for `fields.blocks({ blocks: [...] })`. Editors can only add the blocks listed there. */
export function block<const Slug extends string, F extends Fields>(
	def: BlockInputDef<Slug, F>,
): TypedBlockDef<
	Slug,
	Simplify<{ id: string; blockType: Slug } & InferFields<F>>,
	Simplify<{ id?: string; blockType: Slug } & InferInput<F>>
> {
	return def;
}

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------

/** Set on every document. Dates are ISO 8601 strings. */
export interface SystemFields {
	id: string;
	createdAt: string;
	updatedAt: string;
}

/** Added to `upload: true` collections. Set by the upload endpoint, read-only in the admin. */
export interface UploadFields {
	filename: string;
	mimeType: string;
	filesize: number;
	width?: number | null;
	height?: number | null;
	/** The R2 object key. */
	key: string;
	/** Public URL of the file. Computed on read, not stored. */
	url: string;
}

/** Added to the `auth: true` collection (backed by Better Auth). */
export interface AuthFields {
	email: string;
	name: string;
	/** A `select` field. Define your own `role` select field to change the options. */
	role: string;
	emailVerified: boolean;
	image?: string | null;
}

export interface UploadOptions {
	/** Allowed MIME types, exact (`image/png`) or by prefix (`image/*`). Default: any. */
	mimeTypes?: string[];
	/** Maximum file size in bytes. Default: 50 MiB. */
	maxFileSize?: number;
}

export interface CollectionAdmin<Doc> {
	/** The field shown as the document title in lists and breadcrumbs. Default: `id`. */
	useAsTitle?: keyof Doc & string;
	/** List view columns. Default: the title field, then `updatedAt`. */
	defaultColumns?: (keyof Doc & string)[];
	/** Text fields matched by the list view's search box. Default: the title field. */
	listSearchableFields?: (keyof Doc & string)[];
	description?: string;
	/** Navigation group label. */
	group?: string;
	/** Hide from the admin navigation (the collection is still reachable by URL and API). */
	hidden?: boolean;
	/**
	 * A fixed set of documents (§5, §13.3): nobody can create or delete documents, except trusted
	 * code with `overrideAccess` (`kitcms seed`, RPC `as: 'system'`). Updates follow `access.update`.
	 */
	locked?: boolean;
}

/**
 * Version history and drafts (§13.4).
 * - `true`: every save also stores a version snapshot (history + restore). No drafts.
 * - `{ drafts: true }`: documents can be saved as drafts; public reads only see published docs.
 * - `{ drafts: { autosave: true } }`: the admin saves drafts automatically (default every 2000 ms).
 */
export type VersionsOption =
	| boolean
	| {
			drafts?: boolean | { autosave?: boolean | { interval?: number } };
			/** Versions kept per document; older ones are pruned. Default 50. */
			max?: number;
	  };

/** `_status` is on documents of collections/globals with drafts. */
type StatusFor<V> = V extends { drafts: true | object } ? { _status: 'draft' | 'published' } : unknown;
/** `_order` is on documents of orderable collections (a fractional-index key). */
type OrderFor<O> = O extends true ? { _order: string | null } : unknown;

type DocFor<F extends Fields, U, A, V = false, O = false> = Simplify<
	SystemFields &
		StatusFor<V> &
		OrderFor<O> &
		(U extends false | undefined ? unknown : UploadFields) &
		(A extends true ? AuthFields : unknown) &
		InferFields<F>
>;
type InputFor<F extends Fields, A> = Simplify<
	(A extends true ? Partial<Pick<AuthFields, 'role' | 'image'>> & { email: string; name: string } : unknown) &
		InferInput<F>
>;

export interface CollectionInputDef<
	Slug extends string,
	F extends Fields,
	U extends boolean | UploadOptions,
	A extends boolean,
	V extends VersionsOption = false,
	O extends boolean = false,
> {
	/** Table name and URL segment: lowercase letters, digits, `-` and `_`. */
	slug: Slug;
	fields: F;
	labels?: { singular?: string; plural?: string };
	admin?: CollectionAdmin<DocFor<F, U, A, V, O>>;
	access?: CollectionAccess<DocFor<F, U, A, V, O>>;
	hooks?: CollectionHooks<DocFor<F, U, A, V, O>>;
	/** Default sort for `find` and the list view. Default: `'_order'` when orderable, else `'-createdAt'`. */
	defaultSort?: Sort<DocFor<F, U, A, V, O>>;
	/**
	 * Editors sort documents by drag and drop in the list view (§13.2). Adds the `_order` system
	 * field. Reorder in code with `cms.move(collection, id, { before | after })`.
	 */
	orderable?: O;
	/** Version history and drafts (§13.4). */
	versions?: V;
	/** Files in R2 (§4.8). Adds the upload fields. */
	upload?: U;
	/** The users collection, backed by Better Auth (§4.7). At most one per config. */
	auth?: A;
	/** Extra (composite) indexes on top-level column fields (Decision 30). */
	indexes?: CollectionIndex<DocFor<F, U, A, V, O>>[];
}

/** An index over top-level column fields (or `createdAt`/`updatedAt`/`_order`/`_status`). */
export interface CollectionIndex<Doc = Record<string, unknown>> {
	fields: (keyof Doc & string)[];
	unique?: boolean;
}

/** A collection, made with `collection({ ... })`. `Doc` is the stored shape, `In` the create input. */
export interface CollectionDef<Slug extends string = string, Doc = GenericDoc, In = GenericInput> {
	readonly slug: Slug;
	readonly fields: Fields;
	readonly labels?: { singular?: string; plural?: string };
	readonly admin?: CollectionAdmin<never>;
	readonly access?: CollectionAccess<never>;
	readonly hooks?: CollectionHooks<never>;
	readonly defaultSort?: string;
	readonly upload?: boolean | UploadOptions;
	readonly auth?: boolean;
	readonly orderable?: boolean;
	readonly versions?: VersionsOption;
	readonly indexes?: readonly CollectionIndex<never>[] | readonly { fields: readonly string[]; unique?: boolean }[];
	/** Phantom: the stored document shape. */
	readonly '~doc'?: Doc;
	/** Phantom: the create input shape. */
	readonly '~in'?: In;
}

/** The document type of an untyped (unregistered) config. */
export type GenericDoc = SystemFields & Record<string, unknown>;
export type GenericInput = Record<string, unknown>;

export function collection<
	const Slug extends string,
	F extends Fields,
	const U extends boolean | UploadOptions = false,
	const A extends boolean = false,
	const V extends VersionsOption = false,
	const O extends boolean = false,
>(
	def: CollectionInputDef<Slug, F, U, A, V, O>,
): CollectionDef<Slug, DocFor<F, U, A, V, O>, InputFor<F, A>> {
	return def as never;
}

// ---------------------------------------------------------------------------------------------
// Globals (§13.1)
// ---------------------------------------------------------------------------------------------

/** Access rules of a global. Booleans only. Defaults: signed-in users only (Decision 22). */
export interface GlobalAccess<Doc = Record<string, unknown>> {
	read?: (args: { req: KitcmsReq }) => boolean | Promise<boolean>;
	update?: (args: { req: KitcmsReq; data?: Partial<Doc> }) => boolean | Promise<boolean>;
}

/** The hooks of a global: the collection hooks without the delete hooks. */
export type GlobalHooks<Doc = Record<string, unknown>> = Omit<
	CollectionHooks<Doc>,
	'beforeDelete' | 'afterDelete'
>;

export interface GlobalAdmin {
	description?: string;
	/** Navigation group label. */
	group?: string;
	hidden?: boolean;
}

/** Set on every global document. `createdAt`/`updatedAt` are absent until the first save. */
export interface GlobalSystemFields {
	/** The global's slug. */
	id: string;
	createdAt?: string;
	updatedAt?: string;
}

type GlobalDocFor<F extends Fields, V> = Simplify<GlobalSystemFields & StatusFor<V> & InferFields<F>>;

export interface GlobalInputDef<Slug extends string, F extends Fields, V extends VersionsOption> {
	/** Lowercase letters, digits, `-` and `_`. Unique among globals. */
	slug: Slug;
	fields: F;
	/** Default: from the slug (`site-settings` → `Site settings`). */
	label?: string;
	admin?: GlobalAdmin;
	access?: GlobalAccess<GlobalDocFor<F, V>>;
	hooks?: GlobalHooks<GlobalDocFor<F, V>>;
	versions?: V;
}

/** A global (a single document such as site settings), made with `global({ ... })`. */
export interface GlobalDef<Slug extends string = string, Doc = GenericGlobalDoc, In = GenericInput> {
	readonly slug: Slug;
	readonly fields: Fields;
	readonly label?: string;
	readonly admin?: GlobalAdmin;
	readonly access?: GlobalAccess<never>;
	readonly hooks?: GlobalHooks<never>;
	readonly versions?: VersionsOption;
	/** Phantom: the stored document shape. */
	readonly '~doc'?: Doc;
	/** Phantom: the update input shape. */
	readonly '~in'?: In;
}

export type GenericGlobalDoc = GlobalSystemFields & Record<string, unknown>;

export function global<
	const Slug extends string,
	F extends Fields,
	const V extends VersionsOption = false,
>(def: GlobalInputDef<Slug, F, V>): GlobalDef<Slug, GlobalDocFor<F, V>, InferInput<F>> {
	return def as never;
}

// ---------------------------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------------------------

export interface ConfigOptions {
	/** Names of the Worker bindings. Default: `{ db: 'DB', bucket: 'BUCKET' }`. */
	bindings?: { db?: string; bucket?: string };
	admin?: {
		/** Slug of the `auth: true` collection. Default: the one marked `auth: true`, else a built-in `users`. */
		user?: string;
		/** Shown in the admin header and the browser title. Default: `'kitcms'`. */
		title?: string;
		branding?: Branding;
	};
	media?: {
		/**
		 * Public base URL of the R2 bucket (custom domain or r2.dev), e.g. `https://media.example.com`.
		 * When unset, files are served by the Worker under `/api/media/`.
		 */
		publicUrl?: string;
	};
	/**
	 * The REST fallback API under `/api/collections` and `/api/globals` (§13.7). Default `true`.
	 * Turn it off when every consumer uses the Local API or Service Binding RPC.
	 */
	rest?: boolean;
	/**
	 * Edge cache for anonymous published reads (§13.9). Off by default. Needs a custom domain
	 * (the Cache API is a no-op on `*.workers.dev`).
	 */
	cache?: false | { /** Seconds other regions may serve a stale read after a write. */ ttl: number };
	/**
	 * Plugins (Decision 28), applied in order when the config is sanitized. Each returns a new
	 * config; the result is validated like any config.
	 */
	plugins?: readonly KitcmsPlugin[];
	/** Multi-tenancy (§15.2). Set by `@kitcms/plugin-multi-tenant`. */
	tenancy?: TenancyOptions;
}

/** A plugin: a named config transform (Decision 28). */
export interface KitcmsPlugin {
	/** Shown in config errors. */
	name: string;
	config: (config: Config) => Config;
}

/** White-label branding for the admin (§13.6). */
export interface Branding {
	/** Logo shown in the admin header and login screen: an `https:` URL, a `/`-relative path or a `data:image/` URL. */
	logo?: string;
	/** CSS colors (hex, `rgb()`, `hsl()`, `oklch()` or a named color). */
	colors?: {
		/** Buttons, links, focus rings. */
		accent?: string;
		/** Text on `accent` backgrounds. */
		accentText?: string;
	};
}

export interface Config<
	C extends readonly CollectionDef[] = readonly CollectionDef[],
	G extends readonly GlobalDef[] = readonly GlobalDef[],
> extends ConfigOptions {
	readonly collections: C;
	readonly globals?: G;
}

/** The kitcms config. The only place collections, globals, fields and blocks are defined. */
export function defineConfig<
	const C extends readonly CollectionDef[],
	const G extends readonly GlobalDef[] = [],
>(config: ConfigOptions & { collections: C; globals?: G }): Config<C, G> {
	return config;
}

// ---------------------------------------------------------------------------------------------
// Registration: makes `locals.cms` typed in the app
// ---------------------------------------------------------------------------------------------

/**
 * Register the app's config type once, in `src/app.d.ts`:
 *
 * ```ts
 * import type config from './kitcms.config';
 * declare module '@kitcms/core' {
 *   interface Register { config: typeof config }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Register {}

export type RegisteredConfig = Register extends { config: infer C extends Config } ? C : Config;

// ---------------------------------------------------------------------------------------------
// Lookups (indexed, never re-derived)
// ---------------------------------------------------------------------------------------------

type Collections<C extends Config> = C['collections'][number];
export type CollectionSlug<C extends Config = RegisteredConfig> = Collections<C>['slug'];
export type DocOf<C extends Config, S extends string> = NonNullable<
	Extract<Collections<C>, { readonly slug: S }>['~doc']
>;
export type InputOf<C extends Config, S extends string> = NonNullable<
	Extract<Collections<C>, { readonly slug: S }>['~in']
>;

type Globals<C extends Config> = NonNullable<C['globals']>[number];
export type GlobalSlug<C extends Config = RegisteredConfig> = Globals<C>['slug'];
export type GlobalDocOf<C extends Config, S extends string> = NonNullable<
	Extract<Globals<C>, { readonly slug: S }>['~doc']
>;
export type GlobalInputOf<C extends Config, S extends string> = NonNullable<
	Extract<Globals<C>, { readonly slug: S }>['~in']
>;
