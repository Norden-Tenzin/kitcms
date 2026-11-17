import { describe, expect, it } from 'vitest';
import type { ClientField } from '../config/sanitized';
import { isEmpty, messages, slugify, validateDocument, validateValue } from './validate';

// Literal client fields with defaults filled in.
const base = (name: string, extra: object = {}) => ({
	name,
	label: name,
	required: false,
	admin: {},
	index: false,
	unique: false,
	...extra,
});
const f = (type: string, name: string, extra: object = {}): ClientField =>
	({ ...base(name, extra), type }) as unknown as ClientField;
const text = (name: string, extra: object = {}) => f('text', name, extra);

describe('helpers', () => {
	it('isEmpty', () => {
		expect(isEmpty(undefined)).toBe(true);
		expect(isEmpty(null)).toBe(true);
		expect(isEmpty('')).toBe(true);
		expect(isEmpty(0)).toBe(false);
		expect(isEmpty(false)).toBe(false);
		expect(isEmpty([])).toBe(false);
	});
	it('slugify', () => {
		expect(slugify('Héllo, World!')).toBe('hello-world');
		expect(slugify('  --A  B--  ')).toBe('a-b');
		expect(slugify('!!!')).toBe('');
		expect(slugify('Crème Brûlée 2')).toBe('creme-brulee-2');
	});
});

describe('empty handling', () => {
	it('required fields reject empty values', () => {
		for (const v of [undefined, null, '']) {
			expect(validateValue(text('a', { required: true }), v)).toBe(messages.required());
		}
	});
	it('optional fields accept empty values and skip other rules', () => {
		expect(validateValue(text('a', { minLength: 5 }), '')).toBeNull();
		expect(validateValue(f('email', 'e'), null)).toBeNull();
		expect(validateValue(f('number', 'n', { min: 5, integer: false }), undefined)).toBeNull();
	});
	it('0 and false are not empty', () => {
		expect(validateValue(f('number', 'n', { required: true, integer: false }), 0)).toBeNull();
	});
});

describe('text / textarea', () => {
	it('checks type and length', () => {
		const field = text('t', { minLength: 2, maxLength: 4 });
		expect(validateValue(field, 'abc')).toBeNull();
		expect(validateValue(field, 'a')).toBe(messages.minLength(2));
		expect(validateValue(field, 'abcde')).toBe(messages.maxLength(4));
		expect(validateValue(field, 5)).toBe(messages.text());
		expect(validateValue(f('textarea', 't', { maxLength: 1 }), 'ab')).toBe(messages.maxLength(1));
	});
});

describe('email / slug', () => {
	it('email', () => {
		const field = f('email', 'e');
		expect(validateValue(field, 'a@b.co')).toBeNull();
		for (const bad of ['a@b', 'a b@c.d', '@b.c', 'abc', 5]) {
			expect(validateValue(field, bad)).toBe(messages.email());
		}
	});
	it('slug', () => {
		const field = f('slug', 's');
		expect(validateValue(field, 'hello-world-2')).toBeNull();
		for (const bad of ['Hello', 'a--b', '-a', 'a-', 'a b', 3]) {
			expect(validateValue(field, bad)).toBe(messages.slug());
		}
	});
});

describe('number', () => {
	const field = f('number', 'n', { min: 1, max: 10, integer: true });
	it('accepts in-range integers (inclusive)', () => {
		expect(validateValue(field, 1)).toBeNull();
		expect(validateValue(field, 10)).toBeNull();
	});
	it('rejects bad values', () => {
		expect(validateValue(field, '5')).toBe(messages.number());
		expect(validateValue(field, NaN)).toBe(messages.number());
		expect(validateValue(field, Infinity)).toBe(messages.number());
		expect(validateValue(field, 1.5)).toBe(messages.integer());
		expect(validateValue(field, 0)).toBe(messages.min(1));
		expect(validateValue(field, 11)).toBe(messages.max(10));
	});
	it('allows decimals when not integer', () => {
		expect(validateValue(f('number', 'n', { integer: false }), 1.5)).toBeNull();
	});
});

describe('checkbox', () => {
	it('must be boolean, empty is valid', () => {
		const field = f('checkbox', 'c', { index: false, unique: false });
		expect(validateValue(field, true)).toBeNull();
		expect(validateValue(field, false)).toBeNull();
		expect(validateValue(field, undefined)).toBeNull();
		expect(validateValue(field, 'true')).toBe(messages.boolean());
		expect(validateValue(field, 1)).toBe(messages.boolean());
	});
});

describe('select', () => {
	const field = f('select', 's', {
		options: [
			{ label: 'A', value: 'a' },
			{ label: 'B', value: 'b' },
		],
	});
	it('checks options', () => {
		expect(validateValue(field, 'a')).toBeNull();
		expect(validateValue(field, 'c')).toBe('Must be one of: a, b');
		expect(validateValue(field, 1)).toBe(messages.option(['a', 'b']));
	});
});

describe('date', () => {
	const field = f('date', 'd');
	it('accepts ISO 8601', () => {
		expect(validateValue(field, '2026-01-31')).toBeNull();
		expect(validateValue(field, '2026-01-31T10:00:00.000Z')).toBeNull();
	});
	it('rejects others', () => {
		expect(validateValue(field, 'tomorrow')).toBe(messages.date());
		expect(validateValue(field, '2026-13-45')).toBe(messages.date());
		expect(validateValue(field, 'Jan 5 2026')).toBe(messages.date());
		expect(validateValue(field, 1700000000000)).toBe(messages.date());
	});
});

describe('richText', () => {
	const field = f('richText', 'r');
	it('needs a doc object', () => {
		expect(validateValue(field, { type: 'doc' })).toBeNull();
		expect(validateValue(field, { type: 'doc', content: [] })).toBeNull();
		expect(validateValue(field, { type: 'paragraph' })).toBe(messages.richText());
		expect(validateValue(field, { type: 'doc', content: 'x' })).toBe(messages.richText());
		expect(validateValue(field, 'text')).toBe(messages.richText());
		expect(validateValue(field, [])).toBe(messages.richText());
	});
});

describe('json', () => {
	const field = f('json', 'j');
	it('accepts JSON-like values', () => {
		expect(validateValue(field, { a: [1, 'x', null, { b: true }] })).toBeNull();
		expect(validateValue(field, 5)).toBeNull();
		expect(validateValue(field, [])).toBeNull();
	});
	it('rejects non-JSON values', () => {
		expect(validateValue(field, () => 1)).toBe(messages.json());
		expect(validateValue(field, Symbol('x'))).toBe(messages.json());
		expect(validateValue(field, 10n)).toBe(messages.json());
		expect(validateValue(field, { a: { b: () => 1 } })).toBe(messages.json());
		expect(validateValue(field, { a: undefined })).toBe(messages.json());
	});
	it('survives cycles and deep nesting', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		expect(validateValue(field, cyclic)).toBe(messages.json());
		let deep: unknown = 1;
		for (let i = 0; i < 100; i++) deep = [deep];
		expect(validateValue(field, deep)).toBe(messages.json());
	});
});

describe('relationship / upload', () => {
	for (const type of ['relationship', 'upload']) {
		describe(type, () => {
			const single = f(type, 'r', { relationTo: 'x', hasMany: false });
			const many = f(type, 'r', { relationTo: 'x', hasMany: true, minRows: 1, maxRows: 2 });
			it('single', () => {
				expect(validateValue(single, '01ABC')).toBeNull();
				expect(validateValue(single, 5)).toBe(messages.relation());
				expect(validateValue(single, 'x'.repeat(129))).toBe(messages.relation());
				expect(validateValue(f(type, 'r', { relationTo: 'x', hasMany: false, required: true }), '')).toBe(
					messages.required(),
				);
			});
			it('hasMany', () => {
				expect(validateValue(many, ['a'])).toBeNull();
				expect(validateValue(many, ['a', 'b'])).toBeNull();
				expect(validateValue(many, ['a', 'a'])).toBe(messages.duplicate());
				expect(validateValue(many, ['a', 'b', 'c'])).toBe(messages.maxRows(2));
				expect(validateValue(many, 'a')).toBe(messages.list());
				expect(validateValue(many, ['a', 1])).toBe(messages.relation());
				expect(validateValue(many, [''])).toBe(messages.relation());
			});
			it('hasMany empty', () => {
				const optional = f(type, 'r', { relationTo: 'x', hasMany: true });
				expect(validateValue(optional, [])).toBeNull();
				expect(validateValue(optional, undefined)).toBeNull();
				const required = f(type, 'r', { relationTo: 'x', hasMany: true, required: true });
				expect(validateValue(required, [])).toBe(messages.required());
				expect(validateValue(required, undefined)).toBe(messages.required());
			});
		});
	}
});

describe('container values', () => {
	it('group', () => {
		const group = f('group', 'g', { fields: [], layout: [] });
		expect(validateValue(group, {})).toBeNull();
		expect(validateValue(group, undefined)).toBeNull();
		expect(validateValue(group, [])).toBe(messages.object());
		expect(validateValue(group, 'x')).toBe(messages.object());
	});
	it('array', () => {
		const arr = f('array', 'a', { fields: [], layout: [], minRows: 1, maxRows: 2 });
		expect(validateValue(arr, [{}])).toBeNull();
		expect(validateValue(arr, [{ id: 'x' }])).toBeNull();
		expect(validateValue(arr, [])).toBe(messages.minRows(1));
		expect(validateValue(arr, undefined)).toBe(messages.minRows(1));
		expect(validateValue(arr, [{}, {}, {}])).toBe(messages.maxRows(2));
		expect(validateValue(arr, {})).toBe(messages.list());
		expect(validateValue(arr, ['x'])).toBe(messages.object());
		expect(validateValue(arr, [{ id: '' }])).toBe(messages.rowId());
		expect(validateValue(arr, [{ id: 3 }])).toBe(messages.rowId());
	});
	it('blocks', () => {
		const blocks = f('blocks', 'b', { blocks: [], minRows: 1 });
		expect(validateValue(blocks, [{ blockType: 'x' }])).toBeNull();
		expect(validateValue(blocks, [])).toBe(messages.minRows(1));
		expect(validateValue(blocks, 'x')).toBe(messages.list());
	});
});

describe('validateDocument', () => {
	const fields: ClientField[] = [
		text('title', { required: true }),
		f('group', 'seo', {
			fields: [text('desc', { required: true, maxLength: 3 })],
			layout: [],
		}),
		f('array', 'items', {
			fields: [text('label', { required: true })],
			layout: [],
			maxRows: 3,
		}),
		f('blocks', 'sections', {
			minRows: 0,
			blocks: [
				{
					slug: 'hero',
					labels: { singular: 'Hero', plural: 'Heroes' },
					layout: [],
					admin: {},
					fields: [
						text('heading', { required: true }),
						f('array', 'items', {
							fields: [text('label', { required: true })],
							layout: [],
						}),
					],
				},
			],
		}),
	];

	it('returns no errors for valid data and ignores unknown keys', () => {
		expect(
			validateDocument(fields, {
				title: 'Hi',
				seo: { desc: 'ok' },
				items: [{ label: 'a' }],
				sections: [{ blockType: 'hero', heading: 'H', items: [{ label: 'x' }] }],
				extra: { anything: true },
			}),
		).toEqual([]);
	});

	it('collects all errors with dot paths', () => {
		const errors = validateDocument(fields, {
			seo: { desc: 'toolong' },
			items: [{ label: 'a' }, {}, { label: '' }, { label: 'd' }],
			sections: [
				{ blockType: 'hero', heading: 'H', items: [{ label: 'x' }] },
				{ blockType: 'nope' },
				{ blockType: 'hero', heading: '', items: [{ label: 'a' }, { label: '' }] },
			],
		});
		expect(errors).toEqual([
			{ path: 'title', message: messages.required() },
			{ path: 'seo.desc', message: messages.maxLength(3) },
			{ path: 'items', message: messages.maxRows(3) },
			{ path: 'items.1.label', message: messages.required() },
			{ path: 'items.2.label', message: messages.required() },
			{ path: 'sections.1.blockType', message: messages.unknownBlock('nope') },
			{ path: 'sections.2.heading', message: messages.required() },
			{ path: 'sections.2.items.1.label', message: messages.required() },
		]);
	});

	it('reports required children of an empty group', () => {
		expect(validateDocument(fields, { title: 'x' })).toEqual([
			{ path: 'seo.desc', message: messages.required() },
		]);
	});

	it('reports a missing block type', () => {
		const errors = validateDocument(fields, { title: 'x', seo: { desc: 'a' }, sections: [{}] });
		expect(errors).toEqual([
			{ path: 'sections.0.blockType', message: messages.unknownBlock(undefined) },
		]);
	});

	it('never throws on bad shapes', () => {
		const errors = validateDocument(fields, {
			title: 5,
			seo: 'x',
			items: [null, 'a', 3],
			sections: 'nope',
		});
		expect(errors.map((e) => e.path)).toEqual(['title', 'seo', 'items', 'sections']);
		expect(() => validateDocument(fields, null as never)).not.toThrow();
	});

	it('skip drops a field and its descendants', () => {
		const errors = validateDocument(
			fields,
			{ seo: {}, items: [{}] },
			{ skip: (path) => path === 'seo' || path === 'items' || path === 'title' },
		);
		expect(errors).toEqual([]);
		const partial = validateDocument(
			fields,
			{ title: 'x', seo: {} },
			{ skip: (path) => path === 'seo.desc' },
		);
		expect(partial).toEqual([]);
	});

	it('skip receives the field', () => {
		const seen: string[] = [];
		validateDocument(fields, { title: 'x' }, { skip: (_p, field) => (seen.push(field.type), false) });
		expect(seen).toContain('group');
		expect(seen).toContain('text');
	});

	it('pathPrefix is prepended', () => {
		const errors = validateDocument([text('a', { required: true })], {}, { pathPrefix: 'doc' });
		expect(errors).toEqual([{ path: 'doc.a', message: messages.required() }]);
	});
});
