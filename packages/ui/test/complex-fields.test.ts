// SSR render of the complex field components, plus the contract round trip: the inputs they
// render, submitted as a form, must parse back (core's parseFormData) to the original document.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Admin from '../src/lib/Admin.svelte';
import { parseFormData } from '../../core/src/admin/form';
import type { AdminData, ClientCollection, ClientField } from '@kitcms/core/client';

const base = { required: false, admin: {} };
const text = (name: string, extra: object = {}): ClientField =>
	({ type: 'text', name, label: name, index: false, unique: false, ...base, ...extra }) as ClientField;
const rows = (names: string[]) => names.map((name) => ({ kind: 'field', name }));
const group = (name: string, fields: ClientField[], extra: object = {}): ClientField =>
	({ type: 'group', name, label: name, fields, layout: rows(fields.map((f) => f.name)), ...base, ...extra }) as ClientField;

const checkbox = { type: 'checkbox', name: 'noIndex', label: 'No index', index: false, unique: false, ...base } as ClientField;
const rel = (name: string, relationTo: string, extra: object = {}): ClientField =>
	({ type: 'relationship', name, label: name, relationTo, hasMany: false, ...base, ...extra }) as ClientField;
const upload = (name: string, extra: object = {}): ClientField =>
	({ type: 'upload', name, label: name, relationTo: 'media', hasMany: false, ...base, ...extra }) as ClientField;

const itemFields = [text('label')];
const heroFields = [text('heading'), upload('image')];
const textFields = [text('body')];

const fields: ClientField[] = [
	text('title', { required: true }),
	group('seo', [text('metaTitle'), checkbox]),
	rel('author', 'users'),
	rel('tags', 'tags', { hasMany: true, maxRows: 5 }),
	upload('cover'),
	upload('gallery', { hasMany: true }),
	{
		type: 'array', name: 'items', label: 'Items', fields: itemFields, layout: rows(['label']),
		labels: { singular: 'Item' }, minRows: 0, maxRows: 4, ...base,
	} as ClientField,
	{
		type: 'blocks', name: 'sections', label: 'Sections', labels: { singular: 'Section' }, ...base,
		blocks: [
			{ slug: 'hero', labels: { singular: 'Hero' }, fields: heroFields, layout: rows(['heading', 'image']), admin: {} },
			{ slug: 'text', labels: { singular: 'Text' }, fields: textFields, layout: rows(['body']), admin: {} },
		],
	} as ClientField,
];

const collection = {
	slug: 'pages',
	labels: { singular: 'Page', plural: 'Pages' },
	fields,
	layout: rows(fields.map((f) => f.name)),
	admin: { useAsTitle: 'title', defaultColumns: ['title'], listSearchableFields: ['title'], hidden: false },
	defaultSort: '-createdAt',
	upload: false,
	auth: false,
	access: {},
	hooks: {},
} as unknown as ClientCollection;

const doc = {
	title: 'Home',
	seo: { metaTitle: 'Welcome', noIndex: true },
	author: 'u1',
	tags: ['t1', 't2', 't3'],
	cover: 'm1',
	gallery: ['m2', 'm3'],
	items: [
		{ id: 'i1', label: 'First' },
		{ id: 'i2', label: 'Second' },
	],
	sections: [
		{ id: 's1', blockType: 'hero', heading: 'Hello', image: 'm4' },
		{ id: 's2', blockType: 'text', body: 'Body "quoted" & <b>' },
	],
};

function renderEdit(docValue: Record<string, unknown>, opts: { update?: boolean } = {}): string {
	const data: AdminData = {
		title: 'Test admin',
		user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
		nav: [{ slug: 'pages', label: 'Pages' }],
		route: { view: 'edit', collection: 'pages', id: 'p1' },
		collection,
		permissions: { create: true, update: opts.update ?? true, delete: true },
		doc: { id: 'p1', ...docValue },
		hiddenFields: [],
		isSelf: false,
	};
	return render(Admin, { props: { data } }).body;
}

const decode = (s: string) =>
	s.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'").replaceAll('&amp;', '&');

/** What a browser would submit for the form: named, enabled inputs in DOM order. */
function submit(html: string): FormData {
	const form = new FormData();
	// A control inside a `<fieldset disabled>` isn't submitted either.
	const disabledStack: boolean[] = [];
	for (const m of html.matchAll(/<fieldset\b((?:[^>"]|"[^"]*")*)>|<\/fieldset>|<input\b((?:[^>"]|"[^"]*")*)>/g)) {
		if (m[0].startsWith('<fieldset')) {
			disabledStack.push(/(?:^|\s)disabled(?=[\s=/]|$)/.test(m[1]!));
			continue;
		}
		if (m[0] === '</fieldset>') {
			disabledStack.pop();
			continue;
		}
		if (disabledStack.some(Boolean)) continue;
		const attrs = m[2]!;
		const attr = (n: string) => {
			const r = new RegExp(`(?:^|\\s)${n}(?:="([^"]*)")?(?=\\s|/|$)`).exec(attrs);
			return r ? decode(r[1] ?? '') : null;
		};
		const name = attr('name');
		if (!name || attr('disabled') !== null) continue;
		const type = attr('type') ?? 'text';
		if ((type === 'checkbox' || type === 'radio') && attr('checked') === null) continue;
		form.append(name, attr('value') ?? (type === 'checkbox' ? 'on' : ''));
	}
	return form;
}

describe('complex field components (SSR)', () => {
	const html = renderEdit(doc);

	it('renders the expected input names and markers', () => {
		for (const name of [
			'seo.__present', 'seo.metaTitle', 'seo.noIndex',
			'author', 'tags.__present', 'cover', 'gallery.__present',
			'items.__present', 'items.0.id', 'items.0.label', 'items.1.id',
			'sections.__present', 'sections.0.id', 'sections.0.blockType', 'sections.0.heading', 'sections.0.image',
			'sections.1.blockType', 'sections.1.body',
		]) {
			expect(html, name).toContain(`name="${name}"`);
		}
		expect(html.match(/name="tags"/g)).toHaveLength(3);
		expect(html.match(/name="gallery"/g)).toHaveLength(2);
		expect(html).toContain('Add Item');
		expect(html).toContain('Add block');
		expect(html).toContain('Move row 1 down');
		expect(html).toContain('Drag to reorder row 1');
		expect(html).toContain('role="combobox"');
	});

	it('round-trips the document through parseFormData', () => {
		const { data, errors } = parseFormData(fields, submit(html));
		expect(errors).toEqual([]);
		expect(data).toEqual(doc);
	});

	it('round-trips empty containers and unset relations', () => {
		const empty = { title: 'T', seo: {}, author: null, tags: [], cover: null, gallery: [], items: [], sections: [] };
		const { data } = parseFormData(fields, submit(renderEdit(empty)));
		expect(data).toMatchObject({ author: null, tags: [], cover: null, gallery: [], items: [], sections: [] });
	});

	it('submits nothing for a read-only form', () => {
		const ro = renderEdit(doc, { update: false });
		const { data } = parseFormData(fields, submit(ro));
		expect(data).toEqual({});
		expect(ro).not.toContain('Add block');
		expect(ro).not.toContain('Remove row');
	});

	it('keeps an unknown block row (config changed) with its hidden inputs', () => {
		const out = renderEdit({ ...doc, sections: [{ id: 's9', blockType: 'gone' }] });
		expect(out).toContain('name="sections.0.blockType" value="gone"');
		expect(out).toContain('no longer in the config');
	});
});
