import { describe, expect, it } from 'vitest';
import { applyDefaults, fillSlugs, stripUnknown } from './defaults';
import { array, blocks, field, group, rel, text, upload } from './test-fixtures';

const ID = /^[0-9A-Z]{26}$/;

describe('applyDefaults', () => {
	const fields = [
		text('title', { defaultValue: 'Untitled' }),
		text('lazy', { defaultValue: async () => 'later' }),
		field('checkbox', 'draft'),
		field('checkbox', 'on', { defaultValue: true }),
		rel('tags', 'tags', true),
		upload('gallery', 'media', true),
		rel('cover', 'media'),
		group('seo', [text('t', { defaultValue: 'x' })]),
		array('items', [text('label', { defaultValue: 'L' }), field('checkbox', 'ok')]),
		blocks('sections', [{ slug: 'hero', fields: [text('heading', { defaultValue: 'H' })] }]),
	];

	it('fills everything on create', async () => {
		const d: Record<string, unknown> = {};
		await applyDefaults(fields, d, { operation: 'create' });
		expect(d).toMatchObject({
			title: 'Untitled',
			lazy: 'later',
			draft: false,
			on: true,
			tags: [],
			gallery: [],
			seo: { t: 'x' },
			items: [],
			sections: [],
		});
		expect(d.cover).toBeUndefined();
	});

	it('keeps provided values, including null and false', async () => {
		const d: Record<string, unknown> = { title: null, on: false };
		await applyDefaults(fields, d, { operation: 'create' });
		expect(d.title).toBeNull();
		expect(d.on).toBe(false);
	});

	it('assigns row ids and nested defaults on create', async () => {
		const d: Record<string, unknown> = {
			items: [{}, { id: 'keep', label: 'mine' }],
			sections: [{ blockType: 'hero' }, { blockType: 'zzz' }],
		};
		await applyDefaults(fields, d, { operation: 'create' });
		const items = d.items as Record<string, unknown>[];
		expect(items[0]!.id).toMatch(ID);
		expect(items[0]).toMatchObject({ label: 'L', ok: false });
		expect(items[1]).toMatchObject({ id: 'keep', label: 'mine', ok: false });
		const sections = d.sections as Record<string, unknown>[];
		expect(sections[0]).toMatchObject({ blockType: 'hero', heading: 'H' });
		expect(sections[1]!.id).toMatch(ID);
		expect(sections[1]!.heading).toBeUndefined();
	});

	it('update: no scalar defaults, but shapes, ids and new-row defaults', async () => {
		const d: Record<string, unknown> = {
			items: [{ id: 'old' }, { label: undefined }],
			seo: null,
		};
		await applyDefaults(fields, d, { operation: 'update' });
		expect(d.title).toBeUndefined();
		expect(d.draft).toBeUndefined();
		expect(d.tags).toBeUndefined();
		expect(d.seo).toEqual({});
		expect(d.sections).toEqual([]);
		const items = d.items as Record<string, unknown>[];
		expect(items[0]).toEqual({ id: 'old' });
		expect(items[1]).toMatchObject({ label: 'L', ok: false });
		expect(items[1]!.id).toMatch(ID);
	});

	it('ignores non-object rows and non-array containers', async () => {
		const d: Record<string, unknown> = { items: ['x', null], sections: 'nope', seo: 5 };
		await applyDefaults(fields, d, { operation: 'update' });
		expect(d).toEqual({ items: ['x', null], sections: 'nope', seo: 5 });
	});

	it('clones static defaults', async () => {
		const shared = { a: 1 };
		const f = [field('json', 'j', { defaultValue: shared })];
		const d: Record<string, unknown> = {};
		await applyDefaults(f, d, { operation: 'create' });
		expect(d.j).toEqual(shared);
		expect(d.j).not.toBe(shared);
	});
});

describe('fillSlugs', () => {
	it('fills empty slugs from siblings, recursively', () => {
		const fields = [
			text('title'),
			field('slug', 'slug', { from: 'title' }),
			field('slug', 'noFrom'),
			array('items', [text('name'), field('slug', 's', { from: 'name' })]),
		];
		const d: Record<string, unknown> = {
			title: 'Héllo World',
			slug: '',
			items: [{ name: 'A B' }, { name: 'C', s: 'custom' }, { name: 5 }, { name: '!!!' }],
		};
		fillSlugs(fields, d);
		expect(d.slug).toBe('hello-world');
		expect(d.noFrom).toBeUndefined();
		const items = d.items as Record<string, unknown>[];
		expect(items[0]!.s).toBe('a-b');
		expect(items[1]!.s).toBe('custom');
		expect(items[2]!.s).toBeUndefined();
		expect(items[3]!.s).toBeUndefined();
	});
});

describe('stripUnknown', () => {
	const fields = [
		text('title'),
		group('seo', [text('t')]),
		array('items', [text('label')]),
		blocks('sections', [{ slug: 'hero', fields: [text('heading')] }]),
	];
	it('keeps only defined keys, deep, without system keys', () => {
		const input = {
			id: 'x',
			createdAt: 'c',
			updatedAt: 'u',
			title: 'T',
			evil: 1,
			seo: { t: 'a', evil: 2 },
			items: [{ id: 'i1', label: 'l', evil: 3 }, { label: 'noid' }],
			sections: [
				{ id: 's1', blockType: 'hero', heading: 'h', evil: 4 },
				{ id: 's2', blockType: 'zzz', heading: 'h' },
			],
		};
		const out = stripUnknown(fields, input);
		expect(out).toEqual({
			title: 'T',
			seo: { t: 'a' },
			items: [{ id: 'i1', label: 'l' }, { label: 'noid' }],
			sections: [
				{ id: 's1', blockType: 'hero', heading: 'h' },
				{ id: 's2', blockType: 'zzz' },
			],
		});
		expect(out.seo).not.toBe(input.seo);
	});
	it('keeps non-object container values and skips absent keys', () => {
		expect(stripUnknown(fields, { seo: 'x', items: 'y', sections: [1] })).toEqual({
			seo: 'x',
			items: 'y',
			sections: [1],
		});
	});
});
