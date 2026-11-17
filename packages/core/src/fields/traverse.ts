// Depth-first walk over the data fields of a document (top level, groups, array rows, block rows).

import type { SanitizedField } from '../config/sanitized';

export interface VisitContext {
	field: SanitizedField;
	/** Dot path from the root with row indexes: `sections.2.heading`. */
	path: string;
	/** The container (document, group, array row or block row) holding this field's value. */
	siblingData: Record<string, unknown>;
}

export type VisitResult = void | 'skip';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** The child containers of a field's current value: [fields, data, pathPrefix] triples. */
function children(
	field: SanitizedField,
	value: unknown,
	path: string,
): { fields: readonly SanitizedField[]; data: Record<string, unknown>; prefix: string }[] {
	const out: { fields: readonly SanitizedField[]; data: Record<string, unknown>; prefix: string }[] =
		[];
	if (field.type === 'group') {
		if (isPlainObject(value)) out.push({ fields: field.fields, data: value, prefix: path });
	} else if (field.type === 'array') {
		if (Array.isArray(value))
			value.forEach((row, i) => {
				if (isPlainObject(row)) out.push({ fields: field.fields, data: row, prefix: `${path}.${i}` });
			});
	} else if (field.type === 'blocks') {
		if (Array.isArray(value))
			value.forEach((row, i) => {
				if (!isPlainObject(row)) return;
				const block = field.blocks.find((b) => b.slug === row.blockType);
				if (block) out.push({ fields: block.fields, data: row, prefix: `${path}.${i}` });
			});
	}
	return out;
}

/**
 * Calls `visit` for every field in order, containers before their children. Returning `'skip'`
 * skips that field's descendants. The value is read after `visit` returns, so a visitor may
 * replace it.
 */
export async function traverseFields(
	fields: readonly SanitizedField[],
	data: Record<string, unknown>,
	visit: (ctx: VisitContext) => VisitResult | Promise<VisitResult>,
	pathPrefix = '',
): Promise<void> {
	for (const field of fields) {
		const path = pathPrefix ? `${pathPrefix}.${field.name}` : field.name;
		const result = await visit({ field, path, siblingData: data });
		if (result === 'skip') continue;
		for (const child of children(field, data[field.name], path)) {
			await traverseFields(child.fields, child.data, visit, child.prefix);
		}
	}
}

/** Synchronous twin of {@link traverseFields}. */
export function traverseFieldsSync(
	fields: readonly SanitizedField[],
	data: Record<string, unknown>,
	visit: (ctx: VisitContext) => VisitResult,
	pathPrefix = '',
): void {
	for (const field of fields) {
		const path = pathPrefix ? `${pathPrefix}.${field.name}` : field.name;
		if (visit({ field, path, siblingData: data }) === 'skip') continue;
		for (const child of children(field, data[field.name], path)) {
			traverseFieldsSync(child.fields, child.data, visit, child.prefix);
		}
	}
}
