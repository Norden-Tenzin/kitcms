// Default values, row ids, slug filling and unknown-key stripping. All pure, no DB access.

import type { SanitizedField } from '../config/sanitized';
import { ulid } from '../ulid';
import { isPlainObject, traverseFieldsSync } from './traverse';
import { isEmpty, slugify } from './validate';

const hasId = (row: Record<string, unknown>) => typeof row.id === 'string' && row.id !== '';

/**
 * Mutates `data` in place, recursively.
 * - `create` only: a key that is `undefined` gets `defaultValue` (called if a function, may be
 *   async); else `false` for checkbox, `[]` for hasMany relationship/upload.
 * - Both operations: a missing/null group becomes `{}`, a missing/null array/blocks becomes `[]`,
 *   and every row without a non-empty string `id` gets a ULID.
 * - Recursion into rows: a row that had no id (NEW) is processed with `create` semantics, so its
 *   nested defaults apply even during an update. An existing row is processed with the given
 *   operation (on update: only nested containers get shape defaults and row ids).
 * - Blocks rows of unknown `blockType` only get an id. Non-object rows/values are left alone.
 */
export async function applyDefaults(
	fields: readonly SanitizedField[],
	data: Record<string, unknown>,
	options: { operation: 'create' | 'update' },
): Promise<void> {
	const { operation } = options;
	for (const field of fields) {
		if (operation === 'create' && data[field.name] === undefined) {
			if (field.defaultValue !== undefined) {
				data[field.name] =
					typeof field.defaultValue === 'function'
						? await (field.defaultValue as () => unknown)()
						: structuredClone(field.defaultValue);
			} else if (field.type === 'checkbox') data[field.name] = false;
			else if ((field.type === 'relationship' || field.type === 'upload') && field.hasMany)
				data[field.name] = [];
		}
		const value = data[field.name];
		if (field.type === 'group') {
			if (value === undefined || value === null) data[field.name] = {};
			const group = data[field.name];
			if (isPlainObject(group)) await applyDefaults(field.fields, group, options);
		} else if (field.type === 'array' || field.type === 'blocks') {
			if (value === undefined || value === null) data[field.name] = [];
			const rows = data[field.name];
			if (!Array.isArray(rows)) continue;
			for (const row of rows) {
				if (!isPlainObject(row)) continue;
				const isNew = !hasId(row);
				if (isNew) row.id = ulid();
				const childFields =
					field.type === 'array'
						? field.fields
						: field.blocks.find((b) => b.slug === row.blockType)?.fields;
				if (childFields)
					await applyDefaults(childFields, row, { operation: isNew ? 'create' : operation });
			}
		}
	}
}

/**
 * For every slug field with `from` whose value is empty, sets it to `slugify(sibling[from])` when
 * that sibling is a non-empty string producing a non-empty slug. Recursive, siblings are within
 * the same container.
 */
export function fillSlugs(fields: readonly SanitizedField[], data: Record<string, unknown>): void {
	traverseFieldsSync(fields, data, ({ field, siblingData }) => {
		if (field.type !== 'slug' || !field.from || !isEmpty(siblingData[field.name])) return;
		const source = siblingData[field.from];
		if (typeof source !== 'string' || source === '') return;
		const slug = slugify(source);
		if (slug) siblingData[field.name] = slug;
	});
}

/**
 * Deep copy keeping only keys of defined fields. Array rows keep `id`; block rows keep `id` and
 * `blockType` (rows of unknown block types are reduced to just those). Non-object container values
 * are kept as-is. System keys (`id`, `createdAt`, `updatedAt`) are not kept at the top level.
 */
export function stripUnknown(
	fields: readonly SanitizedField[],
	data: Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const field of fields) {
		if (!Object.hasOwn(data, field.name)) continue;
		const value = data[field.name];
		if (field.type === 'group') {
			out[field.name] = isPlainObject(value) ? stripUnknown(field.fields, value) : value;
		} else if (field.type === 'array') {
			out[field.name] = Array.isArray(value)
				? value.map((row) => {
						if (!isPlainObject(row)) return row;
						const copy = stripUnknown(field.fields, row);
						return Object.hasOwn(row, 'id') ? { id: row.id, ...copy } : copy;
					})
				: value;
		} else if (field.type === 'blocks') {
			out[field.name] = Array.isArray(value)
				? value.map((row) => {
						if (!isPlainObject(row)) return row;
						const block = field.blocks.find((b) => b.slug === row.blockType);
						const copy = block ? stripUnknown(block.fields, row) : {};
						const head: Record<string, unknown> = {};
						if (Object.hasOwn(row, 'id')) head.id = row.id;
						if (Object.hasOwn(row, 'blockType')) head.blockType = row.blockType;
						return { ...head, ...copy };
					})
				: value;
		} else {
			out[field.name] = structuredClone(value);
		}
	}
	return out;
}
