// `sanitizeConfig()`: validates `defineConfig()` output and fills every default (plan §4.5, §5).
// Pure and synchronous: no I/O, no Node APIs (it runs in Workers). Throws `ConfigError` on the
// first problem. `toClientConfig()` derives the serializable subset sent to the admin.

import { ConfigError } from '../errors';
import type { Config, CollectionDef } from './collection';
import type {
	AnyBlock,
	ClientCollection,
	ClientConfig,
	ClientField,
	LayoutNode,
	NormalizedCollectionHooks,
	NormalizedFieldHooks,
	SanitizedBlock,
	SanitizedCollection,
	SanitizedConfig,
	SanitizedField,
} from './sanitized';
import type { SanitizedBranding, SanitizedVersions } from './sanitized';
import {
	COLUMN_TYPES,
	DEFAULT_AUTOSAVE_INTERVAL,
	DEFAULT_MAX_FILE_SIZE,
	DEFAULT_MAX_VERSIONS,
	GLOBAL_TABLE_PREFIX,
	ORDER_FIELD,
	STATUS_FIELD,
	SYSTEM_FIELDS,
	VERSIONS_SUFFIX,
} from './sanitized';

// Raw (unvalidated) config values are loosely typed on purpose: this module is the validator.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const FIELD_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const BLOCK_SLUG = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const COLLECTION_SLUG = /^[a-z][a-z0-9_-]*$/;
const MIME_TYPE = /^[a-z]+\/([a-z0-9.+-]+|\*)$/;

const DATA_TYPES = new Set([
	'text',
	'textarea',
	'email',
	'slug',
	'number',
	'checkbox',
	'select',
	'date',
	'richText',
	'json',
	'relationship',
	'upload',
	'group',
	'array',
	'blocks',
]);
const LAYOUT_TYPES = new Set(['row', 'collapsible', 'tabs']);
const COLUMN_SET: ReadonlySet<string> = new Set(COLUMN_TYPES);
/** Types that take `index` / `unique` options. */
const INDEXABLE = new Set(['text', 'email', 'slug', 'number', 'checkbox', 'select', 'date']);
const TEXT_LIKE = new Set(['text', 'textarea', 'email', 'slug']);

const UPLOAD_RESERVED = ['filename', 'mimeType', 'filesize', 'width', 'height', 'key'];
const AUTH_RESERVED = ['email', 'name', 'emailVerified', 'image'];

/** `metaTitle` → `Meta title`, `meta_title` / `meta-title` → `Meta title`. */
export function toLabel(name: string): string {
	const words = name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const toArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// ---------------------------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------------------------

interface Ctx {
	/** Collection slug → is an upload collection. */
	collections: Map<string, boolean>;
}

interface State {
	fields: SanitizedField[];
	/** Lowercased name → declared name. */
	names: Map<string, string>;
	/** Lowercased reserved names. */
	reserved: Set<string>;
	ctx: Ctx;
}

function newState(ctx: Ctx, reserved: readonly string[]): State {
	return { fields: [], names: new Map(), reserved: new Set(reserved.map((r) => r.toLowerCase())), ctx };
}

function normalizeFieldHooks(raw: Raw | undefined): NormalizedFieldHooks {
	return {
		beforeValidate: toArray(raw?.beforeValidate),
		beforeChange: toArray(raw?.beforeChange),
		afterChange: toArray(raw?.afterChange),
		afterRead: toArray(raw?.afterRead),
	};
}

function checkRange(path: string, label: string, min: unknown, max: unknown, integer: boolean): void {
	for (const [key, v] of [
		['min' + label, min],
		['max' + label, max],
	] as const) {
		if (v === undefined) continue;
		if (integer ? !isNonNegInt(v) : typeof v !== 'number' || !Number.isFinite(v)) {
			throw new ConfigError(`${path}.${key}`, integer ? 'must be a non-negative integer.' : 'must be a finite number.');
		}
	}
	if (min !== undefined && max !== undefined && (min as number) > (max as number)) {
		throw new ConfigError(path, `min${label} must not be greater than max${label}.`);
	}
}

/** Entries of a `fields` record, validated to be an object of objects. */
function entriesOf(fields: unknown, path: string): [string, Raw][] {
	if (!isObject(fields)) throw new ConfigError(path, '`fields` must be an object.');
	return Object.entries(fields).map(([k, v]) => {
		if (!isObject(v) || typeof v.type !== 'string') {
			throw new ConfigError(`${path}.${k}`, 'is not a field. Use the `fields.*` builders.');
		}
		return [k, v];
	});
}

/** Process entries into `st.fields`, returning the layout nodes. Layout children are hoisted. */
function processEntries(entries: [string, Raw][], path: string, st: State): LayoutNode[] {
	const nodes: LayoutNode[] = [];
	for (const [key, raw] of entries) {
		const fpath = `${path}.${key}`;
		const type = raw.type as string;
		if (LAYOUT_TYPES.has(type)) {
			if (type === 'row') {
				nodes.push({ kind: 'row', children: processEntries(entriesOf(raw.fields, `${fpath}.fields`), `${fpath}.fields`, st) });
			} else if (type === 'collapsible') {
				if (typeof raw.label !== 'string' || raw.label.trim() === '') {
					throw new ConfigError(`${fpath}.label`, 'a collapsible needs a non-empty label.');
				}
				nodes.push({
					kind: 'collapsible',
					label: raw.label,
					initCollapsed: raw.admin?.initCollapsed === true,
					children: processEntries(entriesOf(raw.fields, `${fpath}.fields`), `${fpath}.fields`, st),
				});
			} else {
				if (!Array.isArray(raw.tabs) || raw.tabs.length === 0) {
					throw new ConfigError(`${fpath}.tabs`, 'needs at least one tab.');
				}
				const tabs = (raw.tabs as Raw[]).map((tab, i) => {
					const tpath = `${fpath}.tabs.${i}`;
					if (!isObject(tab) || typeof tab.label !== 'string' || tab.label.trim() === '') {
						throw new ConfigError(`${tpath}.label`, 'a tab needs a non-empty label.');
					}
					const out: { label: string; description?: string; children: LayoutNode[] } = {
						label: tab.label,
						children: processEntries(entriesOf(tab.fields, `${tpath}.fields`), `${tpath}.fields`, st),
					};
					if (typeof tab.description === 'string') out.description = tab.description;
					return out;
				});
				nodes.push({ kind: 'tabs', tabs });
			}
			continue;
		}
		if (!DATA_TYPES.has(type)) throw new ConfigError(fpath, `unknown field type "${type}".`);
		if (!FIELD_NAME.test(key)) {
			throw new ConfigError(fpath, 'field names must start with a letter and contain only letters, digits and `_`.');
		}
		const lower = key.toLowerCase();
		if (st.reserved.has(lower)) throw new ConfigError(fpath, `"${key}" is a reserved field name here.`);
		const prior = st.names.get(lower);
		if (prior !== undefined) {
			throw new ConfigError(
				fpath,
				prior === key
					? `duplicate field name "${key}".`
					: `"${key}" collides with "${prior}" (column names are case-insensitive).`,
			);
		}
		st.names.set(lower, key);
		st.fields.push(sanitizeField(key, raw, fpath, st.ctx));
		nodes.push({ kind: 'field', name: key });
	}
	return nodes;
}

/** Fields + layout of one container; checks cross-field rules (`slug.from`). */
function processContainer(
	rawFields: unknown,
	path: string,
	ctx: Ctx,
	reserved: readonly string[],
): { fields: SanitizedField[]; layout: LayoutNode[] } {
	const st = newState(ctx, reserved);
	const layout = processEntries(entriesOf(rawFields, path), path, st);
	checkSlugFrom(st.fields, path);
	return { fields: st.fields, layout };
}

function checkSlugFrom(fields: SanitizedField[], path: string): void {
	for (const f of fields) {
		if (f.type !== 'slug' || f.from === undefined) continue;
		const src = fields.find((o) => o.name === f.from);
		if (!src) throw new ConfigError(`${path}.${f.name}.from`, `"${f.from}" is not a sibling field.`);
		if (!['text', 'textarea', 'email', 'slug'].includes(src.type)) {
			throw new ConfigError(`${path}.${f.name}.from`, `"${f.from}" must be a text, textarea, email or slug field.`);
		}
	}
}

function sanitizeField(name: string, raw: Raw, path: string, ctx: Ctx): SanitizedField {
	const type = raw.type as string;
	if (raw.label !== undefined && typeof raw.label !== 'string') {
		throw new ConfigError(`${path}.label`, 'must be a string.');
	}
	const label: string = raw.label ?? toLabel(name);
	const out: Raw = {
		type,
		name,
		label,
		required: raw.required === true,
		admin: isObject(raw.admin) ? { ...raw.admin } : {},
		hooks: normalizeFieldHooks(raw.hooks),
	};
	if (raw.validate !== undefined) out.validate = raw.validate;
	if (raw.access !== undefined) out.access = raw.access;
	if (raw.defaultValue !== undefined) out.defaultValue = raw.defaultValue;

	// index / unique
	const hasColumnOpt = raw.unique === true || raw.index === true;
	if (INDEXABLE.has(type)) {
		out.index = raw.index === true;
		out.unique = raw.unique === true;
	} else if (hasColumnOpt) {
		throw new ConfigError(path, `\`index\` and \`unique\` are not supported on "${type}" fields.`);
	}

	const dv = raw.defaultValue;
	const staticDv = dv !== undefined && typeof dv !== 'function';
	const checkDv = (kind: 'string' | 'number' | 'boolean') => {
		if (staticDv && typeof dv !== kind) throw new ConfigError(`${path}.defaultValue`, `must be a ${kind} (or a function).`);
	};

	switch (type) {
		case 'text':
		case 'textarea':
			checkRange(path, 'Length', raw.minLength, raw.maxLength, true);
			if (raw.minLength !== undefined) out.minLength = raw.minLength;
			if (raw.maxLength !== undefined) out.maxLength = raw.maxLength;
			checkDv('string');
			break;
		case 'email':
		case 'slug':
			checkDv('string');
			if (type === 'slug' && raw.from !== undefined) {
				if (typeof raw.from !== 'string') throw new ConfigError(`${path}.from`, 'must be a field name.');
				out.from = raw.from;
			}
			break;
		case 'number':
			checkRange(path, '', raw.min, raw.max, false);
			if (raw.min !== undefined) out.min = raw.min;
			if (raw.max !== undefined) out.max = raw.max;
			out.integer = raw.integer === true;
			checkDv('number');
			break;
		case 'checkbox':
			out.required = false;
			out.unique = false;
			checkDv('boolean');
			break;
		case 'date':
			break;
		case 'select': {
			if (!Array.isArray(raw.options) || raw.options.length === 0) {
				throw new ConfigError(`${path}.options`, 'needs at least one option.');
			}
			const seen = new Set<string>();
			out.options = (raw.options as unknown[]).map((o, i) => {
				const opt = typeof o === 'string' ? { label: o, value: o } : o;
				if (!isObject(opt) || typeof opt.value !== 'string' || opt.value === '') {
					throw new ConfigError(`${path}.options.${i}`, 'option values must be non-empty strings.');
				}
				if (seen.has(opt.value)) throw new ConfigError(`${path}.options.${i}`, `duplicate option value "${opt.value}".`);
				seen.add(opt.value);
				return { label: typeof opt.label === 'string' ? opt.label : opt.value, value: opt.value };
			});
			if (staticDv && !seen.has(dv as string)) {
				throw new ConfigError(`${path}.defaultValue`, 'must be one of the option values.');
			}
			break;
		}
		case 'json':
			out.required = false;
			break;
		case 'richText':
			break;
		case 'relationship':
		case 'upload': {
			if (typeof raw.relationTo !== 'string' || !ctx.collections.has(raw.relationTo)) {
				throw new ConfigError(`${path}.relationTo`, `unknown collection "${String(raw.relationTo)}".`);
			}
			if (type === 'upload' && !ctx.collections.get(raw.relationTo)) {
				throw new ConfigError(`${path}.relationTo`, `"${raw.relationTo}" is not an upload collection.`);
			}
			out.relationTo = raw.relationTo;
			out.hasMany = raw.hasMany === true;
			if (!out.hasMany && (raw.minRows !== undefined || raw.maxRows !== undefined)) {
				throw new ConfigError(path, '`minRows` and `maxRows` require `hasMany: true`.');
			}
			checkRange(path, 'Rows', raw.minRows, raw.maxRows, true);
			if (raw.minRows !== undefined) out.minRows = raw.minRows;
			if (raw.maxRows !== undefined) out.maxRows = raw.maxRows;
			break;
		}
		case 'group': {
			out.required = false;
			Object.assign(out, processContainer(raw.fields, `${path}.fields`, ctx, []));
			break;
		}
		case 'array': {
			out.required = false;
			checkRange(path, 'Rows', raw.minRows, raw.maxRows, true);
			if (raw.minRows !== undefined) out.minRows = raw.minRows;
			if (raw.maxRows !== undefined) out.maxRows = raw.maxRows;
			out.labels = { singular: 'Row', plural: label, ...definedLabels(raw.labels) };
			Object.assign(out, processContainer(raw.fields, `${path}.fields`, ctx, ['id']));
			break;
		}
		case 'blocks': {
			out.required = false;
			checkRange(path, 'Rows', raw.minRows, raw.maxRows, true);
			if (raw.minRows !== undefined) out.minRows = raw.minRows;
			if (raw.maxRows !== undefined) out.maxRows = raw.maxRows;
			out.labels = { singular: 'Block', plural: label, ...definedLabels(raw.labels) };
			if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) {
				throw new ConfigError(`${path}.blocks`, 'needs at least one block.');
			}
			const slugs = new Set<string>();
			out.blocks = (raw.blocks as Raw[]).map((b, i): SanitizedBlock => {
				if (!isObject(b) || typeof b.slug !== 'string') {
					throw new ConfigError(`${path}.blocks.${i}`, 'is not a block. Use `block()`.');
				}
				const bpath = `${path}.blocks.${b.slug}`;
				if (!BLOCK_SLUG.test(b.slug)) {
					throw new ConfigError(bpath, 'block slugs must start with a letter and contain only letters, digits, `-` and `_`.');
				}
				if (slugs.has(b.slug)) throw new ConfigError(bpath, `duplicate block slug "${b.slug}".`);
				slugs.add(b.slug);
				const singular = toLabel(b.slug);
				return {
					slug: b.slug,
					labels: { singular, plural: singular + 's', ...definedLabels(b.labels) },
					...processContainer(b.fields, `${bpath}.fields`, ctx, ['id', 'blockType']),
					admin: isObject(b.admin) ? { ...b.admin } : {},
				};
			});
			break;
		}
	}
	return out as SanitizedField;
}

/** Naive English singular for default labels: `Categories` → `Category`, `Boxes` → `Box`, `Pages` → `Page`. */
export function singularize(word: string): string {
	if (/[^aeiou]ies$/i.test(word)) return word.slice(0, -3) + 'y';
	if (/(ss|x|z|ch|sh)es$/i.test(word)) return word.slice(0, -2);
	if (/ss$/i.test(word) || /us$/i.test(word) || /is$/i.test(word)) return word;
	if (word.length > 1 && /s$/i.test(word)) return word.slice(0, -1);
	return word;
}

function definedLabels(raw: unknown): Partial<{ singular: string; plural: string }> {
	const out: Partial<{ singular: string; plural: string }> = {};
	if (isObject(raw)) {
		if (typeof raw.singular === 'string') out.singular = raw.singular;
		if (typeof raw.plural === 'string') out.plural = raw.plural;
	}
	return out;
}

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------

const HOOK_KEYS = [
	'beforeValidate',
	'beforeChange',
	'afterChange',
	'beforeRead',
	'afterRead',
	'beforeDelete',
	'afterDelete',
] as const;

const readOnlySidebar = { readOnly: true, position: 'sidebar' } as const;

function uploadBuiltins(): Record<string, Raw> {
	const text = (extra: Raw = {}): Raw => ({ type: 'text', required: true, admin: { ...readOnlySidebar }, ...extra });
	return {
		filename: text(),
		mimeType: text(),
		filesize: { type: 'number', required: true, integer: true, admin: { ...readOnlySidebar } },
		width: { type: 'number', integer: true, admin: { ...readOnlySidebar } },
		height: { type: 'number', integer: true, admin: { ...readOnlySidebar } },
		key: text({ unique: true, admin: { ...readOnlySidebar, hidden: true } }),
	};
}

function authBuiltins(): Record<string, Raw> {
	return {
		email: { type: 'email', required: true, unique: true },
		name: { type: 'text', required: true },
		role: {
			type: 'select',
			options: ['admin', 'editor'],
			required: true,
			defaultValue: 'editor',
		},
		emailVerified: { type: 'checkbox', admin: { hidden: true } },
		image: { type: 'text', admin: { hidden: true } },
	};
}

function sanitizeUpload(raw: unknown, path: string): SanitizedCollection['upload'] {
	if (raw === undefined || raw === false) return false;
	if (raw !== true && !isObject(raw)) throw new ConfigError(path, 'must be `true` or an options object.');
	const opts: Raw = raw === true ? {} : raw;
	const maxFileSize = opts.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
	if (typeof maxFileSize !== 'number' || !Number.isInteger(maxFileSize) || maxFileSize <= 0) {
		throw new ConfigError(`${path}.maxFileSize`, 'must be a positive integer (bytes).');
	}
	const mimeTypes = opts.mimeTypes ?? [];
	if (!Array.isArray(mimeTypes)) throw new ConfigError(`${path}.mimeTypes`, 'must be an array of MIME types.');
	for (const m of mimeTypes) {
		if (typeof m !== 'string' || !MIME_TYPE.test(m)) {
			throw new ConfigError(`${path}.mimeTypes`, `invalid MIME type ${JSON.stringify(m)} (use \`image/png\` or \`image/*\`).`);
		}
	}
	return { mimeTypes: [...(mimeTypes as string[])], maxFileSize };
}

function sanitizeVersions(raw: unknown, path: string): SanitizedVersions {
	if (raw === undefined || raw === false) return false;
	if (raw === true) return { drafts: false, max: DEFAULT_MAX_VERSIONS };
	if (!isObject(raw)) throw new ConfigError(path, 'must be `true` or an options object.');
	const max = raw.max ?? DEFAULT_MAX_VERSIONS;
	if (typeof max !== 'number' || !Number.isInteger(max) || max < 1) {
		throw new ConfigError(`${path}.max`, 'must be a positive integer.');
	}
	const d = raw.drafts;
	if (d === undefined || d === false) return { drafts: false, max };
	if (d !== true && !isObject(d)) throw new ConfigError(`${path}.drafts`, 'must be `true` or an options object.');
	const a = d === true ? undefined : d.autosave;
	if (a === undefined || a === false) return { drafts: { autosave: false }, max };
	if (a !== true && !isObject(a)) throw new ConfigError(`${path}.drafts.autosave`, 'must be `true` or an options object.');
	const interval = a === true ? DEFAULT_AUTOSAVE_INTERVAL : (a.interval ?? DEFAULT_AUTOSAVE_INTERVAL);
	if (typeof interval !== 'number' || !Number.isInteger(interval) || interval < 500) {
		throw new ConfigError(`${path}.drafts.autosave.interval`, 'must be an integer ≥ 500 (ms).');
	}
	return { drafts: { autosave: { interval } }, max };
}

interface CollectionOpts {
	kind: 'collection' | 'global';
	/** Error path prefix: `collections.pages` or `globals.site`. */
	path: string;
	/** Globals: the public slug. */
	globalSlug?: string;
}

function sanitizeCollection(raw: Raw, ctx: Ctx, opts?: CollectionOpts): SanitizedCollection {
	const slug: string = raw.slug;
	const kind = opts?.kind ?? 'collection';
	const path = opts?.path ?? `collections.${slug}`;
	const auth = raw.auth === true;
	const upload = sanitizeUpload(raw.upload, `${path}.upload`);
	if (raw.orderable !== undefined && typeof raw.orderable !== 'boolean') {
		throw new ConfigError(`${path}.orderable`, 'must be a boolean.');
	}
	const orderable = raw.orderable === true;
	const versions = sanitizeVersions(raw.versions, `${path}.versions`);
	if (auth && versions) throw new ConfigError(`${path}.versions`, 'the auth collection cannot have versions.');
	if (upload && versions && versions.drafts) {
		throw new ConfigError(`${path}.versions.drafts`, 'upload collections cannot have drafts.');
	}

	// Reserved names for user fields.
	const reserved: string[] = [...SYSTEM_FIELDS];
	if (upload) reserved.push(...UPLOAD_RESERVED);
	if (auth) reserved.push(...AUTH_RESERVED);

	const user = processContainer(raw.fields ?? {}, `${path}.fields`, ctx, reserved);

	// Built-in fields, prepended.
	const builtinRaw: Record<string, Raw> = {};
	if (upload) Object.assign(builtinRaw, uploadBuiltins());
	if (auth) {
		const a = authBuiltins();
		const userRole = user.fields.find((f) => f.name.toLowerCase() === 'role');
		if (userRole) {
			const rpath = `${path}.fields.role`;
			if (userRole.name !== 'role' || userRole.type !== 'select') {
				throw new ConfigError(rpath, 'the auth collection\'s `role` must be a top-level `select` field.');
			}
			if (!userRole.options.some((o) => o.value === 'admin')) {
				throw new ConfigError(`${rpath}.options`, 'must include an `admin` option.');
			}
			userRole.required = true;
			delete a.role;
		}
		Object.assign(builtinRaw, a);
	}
	const builtinSt = newState(ctx, []);
	const builtinLayout = processEntries(Object.entries(builtinRaw), `${path}.fields`, builtinSt);
	if (upload) {
		for (const f of builtinSt.fields) f.admin = { ...f.admin, ...readOnlySidebar, ...(f.name === 'key' ? { hidden: true } : {}) };
	}
	const fields = [...builtinSt.fields, ...user.fields];
	const layout = [...builtinLayout, ...user.layout];
	const top = new Map(fields.map((f) => [f.name, f]));

	// admin
	const rawAdmin: Raw = isObject(raw.admin) ? raw.admin : {};
	const isTitleCandidate = (n: string) => {
		if (n === 'id') return true;
		const f = top.get(n);
		return f !== undefined && COLUMN_SET.has(f.type) && f.type !== 'checkbox';
	};
	let useAsTitle: string;
	if (rawAdmin.useAsTitle !== undefined) {
		useAsTitle = rawAdmin.useAsTitle;
		if (typeof useAsTitle !== 'string' || !isTitleCandidate(useAsTitle)) {
			throw new ConfigError(`${path}.admin.useAsTitle`, 'must be `id` or a top-level text, number, select, date, slug or email field.');
		}
	} else {
		const candidates = auth ? ['email'] : upload ? ['filename'] : ['title', 'name'];
		useAsTitle = candidates.find(isTitleCandidate) ?? 'id';
	}

	const columnNames = new Set<string>([...SYSTEM_FIELDS, ...top.keys()]);
	if (orderable) columnNames.add(ORDER_FIELD);
	if (versions && versions.drafts) columnNames.add(STATUS_FIELD);
	let defaultColumns: string[];
	if (rawAdmin.defaultColumns !== undefined) {
		if (!Array.isArray(rawAdmin.defaultColumns)) throw new ConfigError(`${path}.admin.defaultColumns`, 'must be an array.');
		for (const c of rawAdmin.defaultColumns) {
			if (!columnNames.has(c)) throw new ConfigError(`${path}.admin.defaultColumns`, `unknown field "${String(c)}".`);
		}
		defaultColumns = [...rawAdmin.defaultColumns];
	} else {
		defaultColumns = [
			...new Set([useAsTitle, ...(versions && versions.drafts ? [STATUS_FIELD] : []), 'updatedAt']),
		];
	}

	const searchable = (n: string) => {
		const f = top.get(n);
		return f !== undefined && TEXT_LIKE.has(f.type);
	};
	let listSearchableFields: string[];
	if (rawAdmin.listSearchableFields !== undefined) {
		if (!Array.isArray(rawAdmin.listSearchableFields)) {
			throw new ConfigError(`${path}.admin.listSearchableFields`, 'must be an array.');
		}
		for (const c of rawAdmin.listSearchableFields) {
			if (!searchable(c)) {
				throw new ConfigError(`${path}.admin.listSearchableFields`, `"${String(c)}" must be a top-level text, textarea, email or slug field.`);
			}
		}
		listSearchableFields = [...rawAdmin.listSearchableFields];
	} else {
		listSearchableFields = searchable(useAsTitle) ? [useAsTitle] : [];
	}

	const admin: SanitizedCollection['admin'] = {
		useAsTitle,
		defaultColumns,
		listSearchableFields,
		hidden: rawAdmin.hidden === true,
		locked: rawAdmin.locked === true,
	};
	if (rawAdmin.locked !== undefined && typeof rawAdmin.locked !== 'boolean') {
		throw new ConfigError(`${path}.admin.locked`, 'must be a boolean.');
	}
	if (admin.locked && auth) throw new ConfigError(`${path}.admin.locked`, 'the auth collection cannot be locked.');
	if (rawAdmin.description !== undefined) admin.description = rawAdmin.description;
	if (rawAdmin.group !== undefined) admin.group = rawAdmin.group;

	// defaultSort
	const defaultSort: string = raw.defaultSort ?? (orderable ? ORDER_FIELD : '-createdAt');
	if (typeof defaultSort !== 'string') throw new ConfigError(`${path}.defaultSort`, 'must be a string.');
	const sortName = defaultSort.startsWith('-') ? defaultSort.slice(1) : defaultSort;
	const sortField = top.get(sortName);
	const sortable =
		(SYSTEM_FIELDS as readonly string[]).includes(sortName) ||
		(orderable && sortName === ORDER_FIELD) ||
		(versions !== false && versions.drafts !== false && sortName === STATUS_FIELD) ||
		(sortField !== undefined && COLUMN_SET.has(sortField.type));
	if (!sortable) {
		throw new ConfigError(`${path}.defaultSort`, `"${sortName}" must be a system field or a top-level column field.`);
	}

	// labels
	const rawLabels = definedLabels(raw.labels);
	const plural = rawLabels.plural ?? toLabel(slug);
	const singular = rawLabels.singular ?? singularize(plural);

	const rawHooks: Raw = isObject(raw.hooks) ? raw.hooks : {};
	const hooks = Object.fromEntries(HOOK_KEYS.map((k) => [k, toArray(rawHooks[k])])) as unknown as NormalizedCollectionHooks;

	const out: SanitizedCollection = {
		kind,
		slug,
		labels: { singular, plural },
		fields,
		layout,
		admin,
		defaultSort,
		upload,
		auth,
		orderable,
		versions,
		access: isObject(raw.access) ? raw.access : {},
		hooks,
	};
	if (opts?.globalSlug !== undefined) out.globalSlug = opts.globalSlug;
	return out;
}

const GLOBAL_KEYS = new Set(['slug', 'fields', 'label', 'admin', 'access', 'hooks', 'versions']);

function sanitizeGlobal(raw: Raw, ctx: Ctx): SanitizedCollection {
	const slug: string = raw.slug;
	const path = `globals.${slug}`;
	for (const k of Object.keys(raw)) {
		if (!GLOBAL_KEYS.has(k)) throw new ConfigError(`${path}.${k}`, 'is not a global option.');
	}
	const rawAccess: Raw = isObject(raw.access) ? raw.access : {};
	for (const k of Object.keys(rawAccess)) {
		if (k !== 'read' && k !== 'update') throw new ConfigError(`${path}.access.${k}`, 'globals only have `read` and `update` access.');
	}
	const rawHooks: Raw = isObject(raw.hooks) ? raw.hooks : {};
	for (const k of ['beforeDelete', 'afterDelete']) {
		if (rawHooks[k] !== undefined) throw new ConfigError(`${path}.hooks.${k}`, 'globals cannot be deleted.');
	}
	if (raw.label !== undefined && (typeof raw.label !== 'string' || raw.label === '')) {
		throw new ConfigError(`${path}.label`, 'must be a non-empty string.');
	}
	const label: string = raw.label ?? toLabel(slug);
	const rawAdmin: Raw = isObject(raw.admin) ? raw.admin : {};
	const col = sanitizeCollection(
		{
			slug: GLOBAL_TABLE_PREFIX + slug,
			fields: raw.fields,
			labels: { singular: label, plural: label },
			admin: { description: rawAdmin.description, group: rawAdmin.group, hidden: rawAdmin.hidden },
			access: rawAccess,
			hooks: rawHooks,
			versions: raw.versions,
			defaultSort: 'id',
		},
		ctx,
		{ kind: 'global', path, globalSlug: slug },
	);
	if (col.admin.description === undefined) delete col.admin.description;
	if (col.admin.group === undefined) delete col.admin.group;
	return col;
}

/** CSS color grammar for branding: hex, rgb()/rgba()/hsl()/hsla()/oklch()/oklab() with plain numeric args, or a named color. */
const CSS_COLOR =
	/^(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([0-9.%\s,/+-]+(deg)?[0-9.%\s,/+-]*\)|[a-zA-Z]{3,30})$/;

function sanitizeBranding(raw: unknown): SanitizedBranding {
	const path = 'admin.branding';
	if (raw === undefined) return { colors: {} };
	if (!isObject(raw)) throw new ConfigError(path, 'must be an object.');
	const out: SanitizedBranding = { colors: {} };
	if (raw.logo !== undefined) {
		const logo = raw.logo;
		const ok =
			typeof logo === 'string' &&
			logo.length <= 100_000 &&
			!/[\s"'<>()\\]/.test(logo.startsWith('data:') ? '' : logo) &&
			(/^https:\/\/[^\s]+$/.test(logo) ||
				/^\/(?!\/)[^\s]*$/.test(logo) ||
				/^data:image\/(png|jpeg|gif|webp|svg\+xml|avif);base64,[A-Za-z0-9+/=]+$/.test(logo));
		if (!ok) throw new ConfigError(`${path}.logo`, 'must be an https:// URL, a /-relative path or a base64 data:image/ URL.');
		out.logo = logo;
	}
	if (raw.colors !== undefined) {
		if (!isObject(raw.colors)) throw new ConfigError(`${path}.colors`, 'must be an object.');
		for (const [k, v] of Object.entries(raw.colors)) {
			if (k !== 'accent' && k !== 'accentText') throw new ConfigError(`${path}.colors.${k}`, 'unknown color (use `accent` or `accentText`).');
			if (typeof v !== 'string' || v.length > 100 || !CSS_COLOR.test(v.trim())) {
				throw new ConfigError(`${path}.colors.${k}`, 'must be a CSS color: hex, rgb(), hsl(), oklch(), oklab() or a named color.');
			}
			out.colors[k] = v.trim();
		}
		// A custom accent without its text colour could be unreadable (e.g. dark text on a dark accent).
		if ((out.colors.accent === undefined) !== (out.colors.accentText === undefined)) {
			throw new ConfigError(`${path}.colors`, 'set `accent` and `accentText` together, so text on the accent stays readable.');
		}
	}
	return out;
}

// ---------------------------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------------------------

/** A null-prototype lookup: `'constructor'`, `'__proto__'` etc. never resolve to inherited values. */
function lookup<T>(entries: [string, T][]): Record<string, T> {
	return Object.assign(Object.create(null) as Record<string, T>, Object.fromEntries(entries));
}

export function sanitizeConfig(config: Config): SanitizedConfig {
	if (!isObject(config) || !Array.isArray(config.collections)) {
		throw new ConfigError('collections', 'must be an array. Use `defineConfig({ collections: [...] })`.');
	}
	const rawCollections: Raw[] = [...(config.collections as readonly CollectionDef[])] as Raw[];

	const slugs = new Set<string>();
	for (const [i, c] of rawCollections.entries()) {
		if (!isObject(c) || typeof c.slug !== 'string') {
			throw new ConfigError(`collections.${i}`, 'is not a collection. Use `collection()`.');
		}
		const slug = c.slug;
		if (!COLLECTION_SLUG.test(slug)) {
			throw new ConfigError(`collections.${slug}`, 'slugs must start with a lowercase letter and contain only lowercase letters, digits, `-` and `_`.');
		}
		if (
			slug.startsWith('_') ||
			slug.startsWith('auth_') ||
			slug.startsWith('sqlite_') ||
			slug.endsWith(VERSIONS_SUFFIX) ||
			slug === 'd1_migrations'
		) {
			throw new ConfigError(`collections.${slug}`, `"${slug}" is a reserved collection slug.`);
		}
		if (slugs.has(slug)) throw new ConfigError(`collections.${slug}`, `duplicate collection slug "${slug}".`);
		slugs.add(slug);
	}

	const authSlugs = rawCollections.filter((c) => c.auth === true).map((c) => c.slug as string);
	if (authSlugs.length > 1) {
		throw new ConfigError(`collections.${authSlugs[1]}.auth`, `only one collection can have \`auth: true\` (already set on "${authSlugs[0]}").`);
	}
	if (authSlugs.length === 0) {
		if (slugs.has('users')) {
			throw new ConfigError('collections.users', 'no collection has `auth: true`, and "users" is taken. Add `auth: true` to the "users" collection.');
		}
		rawCollections.push({ slug: 'users', auth: true, fields: {} });
	}
	const authCollection = authSlugs[0] ?? 'users';

	const adminUser = config.admin?.user;
	if (adminUser !== undefined && adminUser !== authCollection) {
		throw new ConfigError('admin.user', `must be the slug of the \`auth: true\` collection ("${authCollection}"), got "${adminUser}".`);
	}

	const ctx: Ctx = { collections: new Map(rawCollections.map((c) => [c.slug as string, c.upload !== undefined && c.upload !== false])) };
	const collections = rawCollections.map((c) => sanitizeCollection(c, ctx));

	const rawGlobals: unknown = config.globals ?? [];
	if (!Array.isArray(rawGlobals)) throw new ConfigError('globals', 'must be an array of `global()`s.');
	const globalSlugs = new Set<string>();
	const globals = (rawGlobals as unknown[]).map((g, i) => {
		if (!isObject(g) || typeof g.slug !== 'string') throw new ConfigError(`globals.${i}`, 'is not a global. Use `global()`.');
		const slug: string = g.slug;
		if (!COLLECTION_SLUG.test(slug) || slug.endsWith(VERSIONS_SUFFIX)) {
			throw new ConfigError(`globals.${slug}`, 'slugs must start with a lowercase letter and contain only lowercase letters, digits, `-` and `_` (and not end with `_versions`).');
		}
		if (globalSlugs.has(slug)) throw new ConfigError(`globals.${slug}`, `duplicate global slug "${slug}".`);
		globalSlugs.add(slug);
		return sanitizeGlobal(g, ctx);
	});

	if (config.rest !== undefined && typeof config.rest !== 'boolean') throw new ConfigError('rest', 'must be a boolean.');
	let cache: SanitizedConfig['cache'] = false;
	if (config.cache !== undefined && config.cache !== false) {
		const ttl: unknown = isObject(config.cache) ? config.cache.ttl : undefined;
		if (typeof ttl !== 'number' || !Number.isInteger(ttl) || ttl < 1 || ttl > 86_400) {
			throw new ConfigError('cache.ttl', 'must be an integer number of seconds between 1 and 86400.');
		}
		cache = { ttl };
	}

	const publicUrl = config.media?.publicUrl;
	const media: SanitizedConfig['media'] = {};
	if (publicUrl !== undefined) {
		if (typeof publicUrl !== 'string' || !/^https?:\/\/\S+$/.test(publicUrl)) {
			throw new ConfigError('media.publicUrl', 'must be an http(s):// URL.');
		}
		media.publicUrl = publicUrl.replace(/\/+$/, '');
	}

	return {
		collections,
		collectionsBySlug: lookup(collections.map((c) => [c.slug, c])),
		globals,
		globalsBySlug: lookup(globals.map((g) => [g.globalSlug as string, g])),
		rest: config.rest ?? true,
		cache,
		authCollection,
		bindings: { db: config.bindings?.db ?? 'DB', bucket: config.bindings?.bucket ?? 'BUCKET' },
		admin: { title: config.admin?.title ?? 'kitcms', branding: sanitizeBranding(config.admin?.branding) },
		media,
	};
}

// ---------------------------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------------------------

function toClientField(field: SanitizedField): ClientField {
	const { admin, ...rest } = field;
	const { condition, ...adminRest } = admin;
	const out: Raw = { ...rest, admin: condition ? { ...adminRest, hasCondition: true } : { ...adminRest } };
	for (const k of ['defaultValue', 'validate', 'access', 'hooks']) delete out[k];
	if (field.type === 'group' || field.type === 'array') out.fields = field.fields.map(toClientField);
	if (field.type === 'blocks') {
		out.blocks = field.blocks.map(
			(b: AnyBlock<'server'>): AnyBlock<'client'> => ({
				slug: b.slug,
				labels: b.labels,
				fields: b.fields.map(toClientField),
				layout: b.layout,
				admin: {},
			}),
		);
	}
	return out as ClientField;
}

/** The serializable subset for the browser: no functions, `condition` → `hasCondition`. */
function toClientCollection(c: SanitizedCollection): ClientCollection {
	const out: ClientCollection = {
		kind: c.kind,
		slug: c.slug,
		labels: c.labels,
		fields: c.fields.map(toClientField),
		layout: c.layout,
		admin: c.admin,
		defaultSort: c.defaultSort,
		upload: c.upload,
		auth: c.auth,
		orderable: c.orderable,
		versions: c.versions,
		access: {},
		hooks: {},
	};
	if (c.globalSlug !== undefined) out.globalSlug = c.globalSlug;
	return out;
}

export function toClientConfig(config: SanitizedConfig): ClientConfig {
	return {
		collections: config.collections.map(toClientCollection),
		globals: config.globals.map(toClientCollection),
		authCollection: config.authCollection,
		admin: config.admin,
	};
}
