// Pure helpers for `depth` population; the pipeline does the DB lookups in between.

import type { SanitizedField } from '../config/sanitized';
import { isPlainObject, traverseFieldsSync } from '../fields/traverse';
import { relationIds } from '../refs/extract';

/** Target collection slug → ids, from every relationship/upload value of all docs. */
export function collectRelationIds(
	fields: readonly SanitizedField[],
	docs: readonly Record<string, unknown>[],
	out: Map<string, Set<string>> = new Map(),
): Map<string, Set<string>> {
	for (const doc of docs) {
		traverseFieldsSync(fields, doc, ({ field, siblingData }) => {
			if (field.type !== 'relationship' && field.type !== 'upload') return;
			const ids = relationIds(siblingData[field.name]);
			if (!ids.length) return;
			let set = out.get(field.relationTo);
			if (!set) out.set(field.relationTo, (set = new Set()));
			for (const id of ids) set.add(id);
		});
	}
	return out;
}

type Lookup = (collection: string, id: string) => Record<string, unknown> | undefined;

function replaceInContainer(
	fields: readonly SanitizedField[],
	data: Record<string, unknown>,
	lookup: Lookup,
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...data };
	for (const field of fields) {
		if (!Object.hasOwn(data, field.name)) continue;
		const value = data[field.name];
		if (field.type === 'relationship' || field.type === 'upload') {
			const swap = (v: unknown) =>
				typeof v === 'string' ? (lookup(field.relationTo, v) ?? v) : v;
			out[field.name] = Array.isArray(value) ? value.map(swap) : swap(value);
		} else if (field.type === 'group') {
			if (isPlainObject(value)) out[field.name] = replaceInContainer(field.fields, value, lookup);
		} else if (field.type === 'array') {
			if (Array.isArray(value))
				out[field.name] = value.map((row) =>
					isPlainObject(row) ? replaceInContainer(field.fields, row, lookup) : row,
				);
		} else if (field.type === 'blocks') {
			if (Array.isArray(value))
				out[field.name] = value.map((row) => {
					if (!isPlainObject(row)) return row;
					const block = field.blocks.find((b) => b.slug === row.blockType);
					return block ? replaceInContainer(block.fields, row, lookup) : row;
				});
		}
	}
	return out;
}

/**
 * Returns a NEW doc where each relationship/upload id with a lookup hit is replaced by the looked-up
 * object (hasMany: element-wise, order kept). Misses stay as the id. The input is not mutated.
 */
export function replaceRelationIds(
	fields: readonly SanitizedField[],
	doc: Record<string, unknown>,
	lookup: Lookup,
): Record<string, unknown> {
	return replaceInContainer(fields, doc, lookup);
}
