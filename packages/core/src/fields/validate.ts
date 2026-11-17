// Built-in field validators, shared by the browser (admin forms) and the server (pipeline).
// Browser-safe: type-only imports, no Node APIs, no side effects. Custom `validate` functions
// and uniqueness checks live in the server pipeline, not here.

import type { FieldError } from '../errors';
import type { AnyField, Mode } from '../config/sanitized';

type Field = AnyField<Mode>;

/** Message functions, structured so the admin can translate them later. */
export const messages = {
	required: () => 'Required',
	text: () => 'Must be text',
	rowId: () => 'Row id must be a non-empty string',
	minLength: (n: number) => `Must be at least ${n} character${n === 1 ? '' : 's'}`,
	maxLength: (n: number) => `Must be at most ${n} character${n === 1 ? '' : 's'}`,
	email: () => 'Must be a valid email address',
	slug: () => 'Must be lowercase letters, numbers and single hyphens',
	number: () => 'Must be a number',
	integer: () => 'Must be a whole number',
	min: (n: number) => `Must be at least ${n}`,
	max: (n: number) => `Must be at most ${n}`,
	boolean: () => 'Must be true or false',
	option: (values: readonly string[]) => `Must be one of: ${values.join(', ')}`,
	date: () => 'Must be a valid ISO 8601 date',
	minRows: (n: number) => `Add at least ${n} item${n === 1 ? '' : 's'}`,
	maxRows: (n: number) => `Add at most ${n} item${n === 1 ? '' : 's'}`,
	relation: () => 'Must be a valid reference',
	unknownBlock: (slug: unknown) => `Unknown block type: ${typeof slug === 'string' ? slug : String(slug)}`,
	object: () => 'Must be an object',
	list: () => 'Must be a list',
	duplicate: () => 'Must not contain duplicates',
	richText: () => 'Must be a rich text document',
	json: () => 'Must be valid JSON data',
};

/** `undefined`, `null` and `''` count as "no value". */
export function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

/** `'Héllo, World!'` → `'hello-world'`. */
export function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const MAX_JSON_DEPTH = 64;
const MAX_ID_LENGTH = 128;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function isJsonValue(value: unknown, depth: number): boolean {
	if (depth > MAX_JSON_DEPTH) return false;
	switch (typeof value) {
		case 'string':
		case 'boolean':
			return true;
		case 'number':
			return Number.isFinite(value);
		case 'object': {
			if (value === null) return true;
			if (Array.isArray(value)) return value.every((v) => isJsonValue(v, depth + 1));
			if (!isPlainObject(value)) return false;
			return Object.values(value).every((v) => isJsonValue(v, depth + 1));
		}
		default:
			return false; // undefined, function, symbol, bigint
	}
}

function checkRows(
	length: number,
	field: { minRows?: number; maxRows?: number },
): string | null {
	if (field.minRows !== undefined && length < field.minRows) return messages.minRows(field.minRows);
	if (field.maxRows !== undefined && length > field.maxRows) return messages.maxRows(field.maxRows);
	return null;
}

function checkString(
	value: string,
	field: { minLength?: number; maxLength?: number },
): string | null {
	if (field.minLength !== undefined && value.length < field.minLength)
		return messages.minLength(field.minLength);
	if (field.maxLength !== undefined && value.length > field.maxLength)
		return messages.maxLength(field.maxLength);
	return null;
}

function isRelationId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

/**
 * Built-in rules for one field's value. Doesn't recurse into group/array/blocks children (for
 * those it checks the container shape and row counts). Returns the message, or `null` when valid.
 */
export function validateValue(field: Field, value: unknown): string | null {
	// Containers treat "no value" as empty, so required children and row counts still apply.
	switch (field.type) {
		case 'group':
			if (isEmpty(value)) return null;
			return isPlainObject(value) ? null : messages.object();
		case 'array':
		case 'blocks': {
			const rows = isEmpty(value) ? [] : value;
			if (!Array.isArray(rows)) return messages.list();
			if (rows.length === 0 && field.required) return messages.required();
			if (!rows.every(isPlainObject)) return messages.object();
			if (field.type === 'array') {
				for (const row of rows as Record<string, unknown>[]) {
					const id = row.id;
					if (id !== undefined && (typeof id !== 'string' || id === '')) return messages.rowId();
				}
			}
			return checkRows(rows.length, field);
		}
		case 'checkbox':
			if (isEmpty(value)) return null;
			return typeof value === 'boolean' ? null : messages.boolean();
		case 'relationship':
		case 'upload': {
			if (field.hasMany) {
				const empty = isEmpty(value) || (Array.isArray(value) && value.length === 0);
				if (empty) return field.required ? messages.required() : null;
				if (!Array.isArray(value)) return messages.list();
				if (!value.every(isRelationId)) return messages.relation();
				if (new Set(value).size !== value.length) return messages.duplicate();
				return checkRows(value.length, field);
			}
			if (isEmpty(value)) return field.required ? messages.required() : null;
			return isRelationId(value) ? null : messages.relation();
		}
		default:
			break;
	}

	if (isEmpty(value)) return field.required ? messages.required() : null;

	switch (field.type) {
		case 'text':
		case 'textarea':
			if (typeof value !== 'string') return messages.text();
			return checkString(value, field);
		case 'email':
			return typeof value === 'string' && EMAIL_RE.test(value) ? null : messages.email();
		case 'slug':
			return typeof value === 'string' && SLUG_RE.test(value) ? null : messages.slug();
		case 'number':
			if (typeof value !== 'number' || !Number.isFinite(value)) return messages.number();
			if (field.integer && !Number.isInteger(value)) return messages.integer();
			if (field.min !== undefined && value < field.min) return messages.min(field.min);
			if (field.max !== undefined && value > field.max) return messages.max(field.max);
			return null;
		case 'select': {
			const values = field.options.map((o) => o.value);
			return typeof value === 'string' && values.includes(value) ? null : messages.option(values);
		}
		case 'date':
			return typeof value === 'string' && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value))
				? null
				: messages.date();
		case 'richText':
			return isPlainObject(value) &&
				value.type === 'doc' &&
				(value.content === undefined || Array.isArray(value.content))
				? null
				: messages.richText();
		case 'json':
			return isJsonValue(value, 0) ? null : messages.json();
		default:
			return null;
	}
}

export interface ValidateDocumentOptions {
	/** Return true to skip a field and its descendants (e.g. hidden by `admin.condition`). */
	skip?: (path: string, field: Field) => boolean;
	/** Prepended to every error path. */
	pathPrefix?: string;
}

/**
 * Validate `data` against `fields`, recursing into group/array/blocks and collecting ALL errors.
 * Unknown keys are ignored. Never throws on bad input shapes; it reports them.
 */
export function validateDocument(
	fields: readonly Field[],
	data: Record<string, unknown>,
	options: ValidateDocumentOptions = {},
): FieldError[] {
	const errors: FieldError[] = [];
	const source = isPlainObject(data) ? data : {};
	walk(fields, source, options.pathPrefix ?? '', options, errors);
	return errors;
}

function join(prefix: string, key: string | number): string {
	return prefix === '' ? String(key) : `${prefix}.${key}`;
}

function walk(
	fields: readonly Field[],
	data: Record<string, unknown>,
	prefix: string,
	options: ValidateDocumentOptions,
	errors: FieldError[],
): void {
	for (const field of fields) {
		const path = join(prefix, field.name);
		if (options.skip?.(path, field)) continue;
		const value = data[field.name];

		const message = validateValue(field, value);
		if (message !== null) errors.push({ path, message });

		switch (field.type) {
			case 'group': {
				if (isEmpty(value)) walk(field.fields, {}, path, options, errors);
				else if (isPlainObject(value)) walk(field.fields, value, path, options, errors);
				break;
			}
			case 'array': {
				const rows = Array.isArray(value) ? value : [];
				rows.forEach((row: unknown, i) => {
					if (isPlainObject(row)) walk(field.fields, row, join(path, i), options, errors);
				});
				break;
			}
			case 'blocks': {
				const rows = Array.isArray(value) ? value : [];
				rows.forEach((row: unknown, i) => {
					if (!isPlainObject(row)) return;
					const rowPath = join(path, i);
					const block = field.blocks.find((b) => b.slug === row.blockType);
					if (!block) {
						errors.push({
							path: join(rowPath, 'blockType'),
							message: messages.unknownBlock(row.blockType),
						});
						return;
					}
					walk(block.fields, row, rowPath, options, errors);
				});
				break;
			}
			default:
				break;
		}
	}
}
