// Literal SanitizedField builders for tests.
import type { SanitizedField } from '../config/sanitized';

export function field(type: string, name: string, extra: object = {}): SanitizedField {
	return {
		type,
		name,
		label: name,
		required: false,
		admin: {},
		index: false,
		unique: false,
		hooks: { beforeValidate: [], beforeChange: [], afterChange: [], afterRead: [] },
		...extra,
	} as unknown as SanitizedField;
}

export const text = (name: string, extra: object = {}) => field('text', name, extra);
export const group = (name: string, fields: SanitizedField[], extra: object = {}) =>
	field('group', name, { fields, layout: [], ...extra });
export const array = (name: string, fields: SanitizedField[], extra: object = {}) =>
	field('array', name, { fields, layout: [], labels: { singular: 'Row', plural: 'Rows' }, ...extra });
export const blocks = (
	name: string,
	defs: { slug: string; fields: SanitizedField[] }[],
	extra: object = {},
) =>
	field('blocks', name, {
		blocks: defs.map((b) => ({
			...b,
			labels: { singular: b.slug, plural: b.slug },
			layout: [],
			admin: {},
		})),
		labels: { singular: 'Block', plural: 'Blocks' },
		...extra,
	});
export const rel = (name: string, relationTo: string, hasMany = false, extra: object = {}) =>
	field('relationship', name, { relationTo, hasMany, ...extra });
export const upload = (name: string, relationTo: string, hasMany = false, extra: object = {}) =>
	field('upload', name, { relationTo, hasMany, ...extra });
