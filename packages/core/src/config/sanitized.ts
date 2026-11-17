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

export interface AnyCollection<M extends Mode = 'server'> {
	slug: string;
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
	};
	/** `'-createdAt'` unless set. */
	defaultSort: string;
	upload: false | { mimeTypes: string[]; maxFileSize: number };
	auth: boolean;
	/** Server only. As written in the config (defaults are applied by the access engine). */
	access: M extends 'server' ? CollectionAccess : Record<string, never>;
	hooks: M extends 'server' ? NormalizedCollectionHooks : Record<string, never>;
}
export type SanitizedCollection = AnyCollection<'server'>;
export type ClientCollection = AnyCollection<'client'>;

export interface SanitizedConfig {
	collections: SanitizedCollection[];
	/** Lookup by slug. */
	collectionsBySlug: Record<string, SanitizedCollection>;
	/** Slug of the `auth: true` collection (added as `users` when the config has none). */
	authCollection: string;
	bindings: { db: string; bucket: string };
	admin: { title: string };
	media: { publicUrl?: string };
}

/** What the admin in the browser receives: no functions, JSON-serializable. */
export interface ClientConfig {
	collections: ClientCollection[];
	authCollection: string;
	admin: { title: string };
}

/** Built-in default: 50 MiB. */
export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;
/** Reserved top-level field names. */
export const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt'] as const;
