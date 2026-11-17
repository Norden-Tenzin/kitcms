// Extracts the `_refs` rows of a document from its relationship/upload fields.

import type { Ref } from '../db/adapter';
import { traverseFieldsSync } from '../fields/traverse';
import type { SanitizedField } from '../config/sanitized';

/** Ids held by a relationship/upload value: a string, or the strings of an array. */
export function relationIds(value: unknown): string[] {
	if (typeof value === 'string') return value === '' ? [] : [value];
	if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v !== '');
	return [];
}

/**
 * One Ref per id of every relationship/upload value anywhere in the document. hasMany ids share the
 * field's path. Identical (path, toCollection, toId) triples are deduplicated; traversal order.
 */
export function extractRefs(fields: readonly SanitizedField[], doc: Record<string, unknown>): Ref[] {
	const refs: Ref[] = [];
	const seen = new Set<string>();
	traverseFieldsSync(fields, doc, ({ field, path, siblingData }) => {
		if (field.type !== 'relationship' && field.type !== 'upload') return;
		for (const toId of relationIds(siblingData[field.name])) {
			const key = JSON.stringify([path, field.relationTo, toId]);
			if (seen.has(key)) continue;
			seen.add(key);
			refs.push({ path, toCollection: field.relationTo, toId });
		}
	});
	return refs;
}
