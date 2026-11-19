// The sanitized config: what `sanitizeConfig()` produces from `defineConfig()` output, and what
// every runtime module (schema, pipeline, admin, RPC) consumes. Plain data plus server-only
// functions. `ClientConfig` is its serializable subset, sent to the admin in the browser.
//
// Shape rules:
// - `fields` holds DATA fields only, in declaration order, with layout fields (row/collapsible/
//   tabs) flattened away. Names are unique per container (collection, group, array row, block).
// - `layout` keeps the admin presentation tree, referencing data fields by name.
// - Every option has its default filled in, so consumers never re-apply defaults.
// - Upload and auth collections include their built-in fields as ordinary sanitized fields.

import type { AdminPanelDef, EntitlementsProvider, PluginEndpoint, PluginHandle } from './plugin';
import type { Resolvable } from './resolvable';
import type { BlockAdmin, DataFieldType, FieldAdmin } from './fields';
import type {
	CollectionAccess,
	CollectionHooks,
	FieldAccess,
	FieldHook,
	FieldValidate,
} from './hooks';

/** `'server'`: the sanitized config. `'client'`: the serializable subset for the browser. */
export type Mode = 'server' | 'client';

type ServerOnly<M extends Mode, T> = M extends 'server' ? T : unknown;

export interface NormalizedFieldHooks {
	beforeValidate: FieldHook<unknown>[];
	beforeChange: FieldHook<unknown>[];
	afterChange: FieldHook<unknown>[];
	afterRead: FieldHook<unknown>[];
}

/** Admin options in the browser: functions removed. */
export interface ClientFieldAdmin extends Omit<FieldAdmin, 'condition'> {
	/** True when a server-side `condition` exists (the admin re-evaluates it on each round trip). */
	hasCondition?: boolean;
	rows?: number;
	step?: number;
	picker?: 'day' | 'dayAndTime';
}

interface FieldBase<T extends DataFieldType, M extends Mode> {
	type: T;
	name: string;
	/** Defaulted from the name: `metaTitle` → `Meta title`. */
	label: string;
	required: boolean;
	admin: M extends 'server' ? FieldAdmin & ClientFieldAdmin : ClientFieldAdmin;
}

type ServerExtras<M extends Mode> = ServerOnly<
	M,
	{
		/** A static value or a function, called per create. */
		defaultValue?: unknown;
		validate?: FieldValidate<unknown>;
		access?: FieldAccess;
		hooks: NormalizedFieldHooks;
	}
>;

interface Column {
	index: boolean;
	unique: boolean;
}

export type AnyField<M extends Mode = 'server'> = (
	| (FieldBase<'text', M> & Column & { minLength?: number; maxLength?: number })
	| (FieldBase<'textarea', M> & { minLength?: number; maxLength?: number })
	| (FieldBase<'email', M> & Column)
	| (FieldBase<'slug', M> & Column & { from?: string })
	| (FieldBase<'number', M> & Column & { min?: number; max?: number; integer: boolean })
	| (FieldBase<'checkbox', M> & { index: boolean; unique: false })
	| (FieldBase<'select', M> & Column & { options: { label: string; value: string }[] })
	| (FieldBase<'date', M> & Column)
	| FieldBase<'richText', M>
	| FieldBase<'json', M>
	| (FieldBase<'relationship' | 'upload', M> & {
			relationTo: string;
			hasMany: boolean;
			minRows?: number;
			maxRows?: number;
	  })
	| (FieldBase<'group', M> & { fields: AnyField<M>[]; layout: LayoutNode[] })
	| (FieldBase<'array', M> & {
			fields: AnyField<M>[];
			layout: LayoutNode[];
			minRows?: number;
			maxRows?: number;
			labels: Labels;
	  })
	| (FieldBase<'blocks', M> & {
			blocks: AnyBlock<M>[];
			minRows?: number;
			maxRows?: number;
			labels: Labels;
	  })
) &
	ServerExtras<M>;

export type SanitizedField = AnyField<'server'>;
export type ClientField = AnyField<'client'>;

/** Narrow a field union by type: `FieldOf<'select'>`. */
export type FieldOf<T extends DataFieldType, M extends Mode = 'server'> = Extract<
	AnyField<M>,
	{ type: T }
>;

/** Field types stored as a real column (filterable, sortable, indexable). */
export const COLUMN_TYPES = [
	'text',
	'textarea',
	'email',
	'slug',
	'number',
	'checkbox',
	'select',
	'date',
] as const;
/** Field types stored as one JSON `TEXT` column. */
export const JSON_TYPES = ['group', 'array', 'blocks', 'json', 'richText'] as const;

export interface Labels {
	singular: string;
	plural: string;
}

/** Admin layout tree. Leaves reference data fields of the same container by name. */
export type LayoutNode =
	| { kind: 'field'; name: string }
	| { kind: 'row'; children: LayoutNode[] }
	| { kind: 'collapsible'; label: string; initCollapsed: boolean; children: LayoutNode[] }
	| {
			kind: 'tabs';
			tabs: { label: string; description?: string; children: LayoutNode[] }[];
	  };

export interface AnyBlock<M extends Mode = 'server'> {
	slug: string;
	labels: Labels;
	fields: AnyField<M>[];
	layout: LayoutNode[];
	/** Server only: the preview component (Phase 2). */
	admin: M extends 'server' ? BlockAdmin : Record<string, never>;
}
export type SanitizedBlock = AnyBlock<'server'>;

type HookFn<K extends keyof CollectionHooks> = Exclude<NonNullable<CollectionHooks[K]>, unknown[]>;
/** Collection hooks with every entry normalized to an array (possibly empty). */
export type NormalizedCollectionHooks = { [K in keyof CollectionHooks]-?: HookFn<K>[] };

/** Sanitized `versions` option (§13.4). */
export type SanitizedVersions =
	| false
	| {
			/** `false` = history only. */
			drafts: false | { autosave: false | { interval: number } };
			/** Versions kept per document. */
			max: number;
	  };

/**
 * A collection, or a global (§13.1). A global is a single-row collection internally:
 * `kind: 'global'`, `slug` = its table name `_global_<slug>`, `globalSlug` = the public slug.
 * Globals are never in `collectionsBySlug`, so the collection API can't reach them.
 */
export interface AnyCollection<M extends Mode = 'server'> {
	kind: 'collection' | 'global';
	/** The table name. For a global: `_global_<globalSlug>`. */
	slug: string;
	/** Globals only: the public slug (`cms.findGlobal(globalSlug)`, `/admin/globals/<globalSlug>`). */
	globalSlug?: string;
	labels: Labels;
	/** Data fields, including built-in upload/auth fields. Excludes `id`, `createdAt`, `updatedAt`. */
	fields: AnyField<M>[];
	layout: LayoutNode[];
	admin: {
		/** A top-level column field name, or `'id'`. */
		useAsTitle: string;
		defaultColumns: string[];
		listSearchableFields: string[];
		description?: string;
		group?: string;
		hidden: boolean;
		/** No create/delete except with `overrideAccess` (§13.3). Always `false` for globals. */
		locked: boolean;
	};
	/** `'_order'` for orderable collections, else `'-createdAt'`, unless set. */
	defaultSort: string;
	upload: false | { mimeTypes: string[]; maxFileSize: number };
	auth: boolean;
	/** Has the `_order` system column (§13.2). Always `false` for globals. */
	orderable: boolean;
	versions: SanitizedVersions;
	/** Extra indexes (Decision 30), validated: top-level column fields or system columns. */
	indexes: { fields: string[]; unique: boolean }[];
	/** Runtime add-on gate (Decision 34). Absent = always on. */
	entitlement?: string;
	/** Server only. As written in the config (defaults are applied by the access engine). */
	access: M extends 'server' ? CollectionAccess : Record<string, never>;
	hooks: M extends 'server' ? NormalizedCollectionHooks : Record<string, never>;
}
export type SanitizedCollection = AnyCollection<'server'>;
export type ClientCollection = AnyCollection<'client'>;

export interface SanitizedConfig {
	/** Collections only (never globals). */
	collections: SanitizedCollection[];
	/** Lookup by slug. Collections only: globals are deliberately absent. */
	collectionsBySlug: Record<string, SanitizedCollection>;
	/** Globals (`kind: 'global'`), in config order. */
	globals: SanitizedCollection[];
	/** Lookup by PUBLIC global slug. */
	globalsBySlug: Record<string, SanitizedCollection>;
	/** REST fallback API on (§13.7). */
	rest: boolean;
	/** Edge cache for anonymous published reads (§13.9). */
	cache: false | { ttl: number };
	/** Slug of the `auth: true` collection (added as `users` when the config has none). */
	authCollection: string;
	bindings: { db: string; bucket: string; email: string };
	admin: { title: Resolvable<string>; branding: SanitizedBranding };
	media: { publicUrl?: string };
	/** Plugins that contribute server code (Decision 33), in config order. */
	plugins: SanitizedPlugin[];
	/** Decision 34. Present whenever anything has an `entitlement`. */
	entitlements?: EntitlementsProvider;
	/** Decision 35. `null` = email disabled. */
	email: SanitizedEmail | null;
	/** Decision 43. */
	system: { secret: string; seeds: Record<string, (input: unknown) => unknown> };
}

/** Decision 35. Static values are validated at sanitize time, functions (Decision 41) when sending. */
export interface SanitizedEmail {
	from: Resolvable<{ address: string; name?: string }>;
	replyTo?: Resolvable<string | undefined>;
}

/** A plugin's runtime parts (Decision 33), validated. */
export interface SanitizedPlugin {
	name: string;
	entitlement?: string;
	handle?: PluginHandle;
	endpoints: (PluginEndpoint & { maxBodyBytes: number; segments: string[] })[];
	panels: AdminPanelDef[];
}

/** Validated branding (§13.6): every value is safe to put in a CSS variable / `src`. */
export interface SanitizedBranding {
	logo?: string;
	colors: { accent?: string; accentText?: string };
}

/** What the admin in the browser receives: no functions, JSON-serializable. */
export interface ClientConfig {
	collections: ClientCollection[];
	globals: ClientCollection[];
	authCollection: string;
	admin: { title: string; branding: SanitizedBranding };
}

/** Built-in default: 50 MiB. */
export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;
/** Reserved top-level field names. */
export const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt'] as const;
/** System column of orderable collections (§13.2). */
export const ORDER_FIELD = '_order';
/** System column of collections/globals with drafts (§13.4). */
export const STATUS_FIELD = '_status';
/** Table-name prefix of globals (§13.1). */
export const GLOBAL_TABLE_PREFIX = '_global_';
/** Suffix of version tables (§13.4): `pages_versions`, `_global_site_versions`. */
export const VERSIONS_SUFFIX = '_versions';
/** Default autosave interval, ms. */
export const DEFAULT_AUTOSAVE_INTERVAL = 2000;
/** Default versions kept per document. */
export const DEFAULT_MAX_VERSIONS = 50;
