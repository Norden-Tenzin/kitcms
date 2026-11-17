// SSR render of RichTextField: static rendering + hidden JSON input, no Tiptap on the server,
// and the parseFormData round trip.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Admin from '../src/lib/Admin.svelte';
import { parseFormData } from '../../core/src/admin/form';
import type { AdminData, ClientCollection, ClientField } from '@kitcms/core/client';

const base = { required: false, admin: {} };
const fields: ClientField[] = [
	{ type: 'text', name: 'title', label: 'title', index: false, unique: false, ...base } as ClientField,
	{ type: 'richText', name: 'body', label: 'Body', ...base } as ClientField,
];
const collection = {
	slug: 'pages',
	labels: { singular: 'Page', plural: 'Pages' },
	fields,
	layout: fields.map((f) => ({ kind: 'field', name: f.name })),
	admin: { useAsTitle: 'title', defaultColumns: ['title'], listSearchableFields: ['title'], hidden: false },
	defaultSort: '-createdAt',
	upload: false,
	auth: false,
	access: {},
	hooks: {},
} as unknown as ClientCollection;

const body = {
	type: 'doc',
	content: [
		{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi & "bye"' }] },
		{ type: 'paragraph', content: [{ type: 'text', text: 'a <b>', marks: [{ type: 'bold' }] }] },
	],
};

function renderEdit(docValue: Record<string, unknown>, update = true): string {
	const data = {
		title: 'Test admin',
		user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
		nav: [{ slug: 'pages', label: 'Pages' }],
		globals: [],
		branding: { colors: {} },
		route: { view: 'edit', collection: 'pages', id: 'p1' },
		collection,
		permissions: { create: true, update, delete: true },
		doc: { id: 'p1', ...docValue },
		hiddenFields: [],
		isSelf: false,
	} as unknown as AdminData;
	return render(Admin, { props: { data } }).body;
}

const decode = (s: string) =>
	s.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'").replaceAll('&amp;', '&');

function hiddenValue(html: string, name: string): { value: string; disabled: boolean } | null {
	const m = new RegExp(`<input\\b((?:[^>"]|"[^"]*")*name="${name}"(?:[^>"]|"[^"]*")*)>`).exec(html);
	if (!m) return null;
	const v = /value="([^"]*)"/.exec(m[1]!);
	return { value: decode(v?.[1] ?? ''), disabled: /(?:^|\s)disabled(?=[\s=/]|$)/.test(m[1]!) };
}

describe('RichTextField (SSR)', () => {
	it('renders the static content and a hidden JSON input; no editor chrome', () => {
		const html = renderEdit({ title: 'T', body });
		expect(html).toContain('<h2>Hi &amp; &quot;bye&quot;</h2>');
		expect(html).toContain('<strong>a &lt;b&gt;</strong>');
		expect(html).not.toContain('role="toolbar"');
		expect(html).not.toContain('ProseMirror');
		const input = hiddenValue(html, 'body')!;
		expect(JSON.parse(input.value)).toEqual(body);
		expect(input.disabled).toBe(false);
	});

	it('round trips through parseFormData', () => {
		const html = renderEdit({ title: 'T', body });
		const form = new FormData();
		form.append('title', 'T');
		form.append('body', hiddenValue(html, 'body')!.value);
		const { data, errors } = parseFormData(fields, form);
		expect(errors).toEqual([]);
		expect(data.body).toEqual(body);
	});

	it('empty value submits an empty string, parsed as null', () => {
		const html = renderEdit({ title: 'T', body: null });
		const input = hiddenValue(html, 'body')!;
		expect(input.value).toBe('');
		const form = new FormData();
		form.append('body', input.value);
		expect(parseFormData(fields, form).data.body).toBeNull();
	});

	it('is disabled when the form is read-only', () => {
		const html = renderEdit({ title: 'T', body }, false);
		expect(hiddenValue(html, 'body')!.disabled).toBe(true);
	});
});
