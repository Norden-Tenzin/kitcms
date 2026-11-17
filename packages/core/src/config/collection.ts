// `block()`, `collection()` and `defineConfig()`: the only place schema exists (principle 3).
// Each builder returns its input unchanged at runtime and computes the document types once.

import type { BlockAdmin, BlockDef, Fields } from './fields';
import type { CollectionAccess, CollectionHooks } from './hooks';
import type { InferFields, InferInput, Simplify } from './infer';
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
}

type DocFor<F extends Fields, U, A> = Simplify<
	SystemFields &
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
> {
	/** Table name and URL segment: lowercase letters, digits, `-` and `_`. */
	slug: Slug;
	fields: F;
	labels?: { singular?: string; plural?: string };
	admin?: CollectionAdmin<DocFor<F, U, A>>;
	access?: CollectionAccess<DocFor<F, U, A>>;
	hooks?: CollectionHooks<DocFor<F, U, A>>;
	/** Default sort for `find` and the list view. Default: `'-createdAt'`. */
	defaultSort?: Sort<DocFor<F, U, A>>;
	/** Files in R2 (§4.8). Adds the upload fields. */
	upload?: U;
	/** The users collection, backed by Better Auth (§4.7). At most one per config. */
	auth?: A;
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
>(def: CollectionInputDef<Slug, F, U, A>): CollectionDef<Slug, DocFor<F, U, A>, InputFor<F, A>> {
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
	};
	media?: {
		/**
		 * Public base URL of the R2 bucket (custom domain or r2.dev), e.g. `https://media.example.com`.
		 * When unset, files are served by the Worker under `/api/media/`.
		 */
		publicUrl?: string;
	};
}

export interface Config<C extends readonly CollectionDef[] = readonly CollectionDef[]>
	extends ConfigOptions {
	readonly collections: C;
}

/** The kitcms config. The only place collections, fields and blocks are defined. */
export function defineConfig<const C extends readonly CollectionDef[]>(
	config: ConfigOptions & { collections: C },
): Config<C> {
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
