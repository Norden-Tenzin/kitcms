import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Admin from '../src/lib/Admin.svelte';
import type { AdminData, ClientCollection } from '@kitcms/core/client';

const text = (name: string, extra: object = {}) => ({
	type: 'text',
	name,
	label: name[0]!.toUpperCase() + name.slice(1),
	required: false,
	index: false,
	unique: false,
	admin: {},
	...extra,
});

const pages = (versions: unknown) =>
	({
		kind: 'collection',
		slug: 'pages',
		labels: { singular: 'Page', plural: 'Pages' },
		fields: [text('title', { required: true })],
		layout: [{ kind: 'field', name: 'title' }],
		admin: { useAsTitle: 'title', defaultColumns: ['title', '_status', 'updatedAt'], listSearchableFields: [], hidden: false },
		defaultSort: '-createdAt',
		upload: false,
		auth: false,
		orderable: false,
		versions,
		access: {},
		hooks: {},
	}) as unknown as ClientCollection;

const withAutosave = pages({ drafts: { autosave: { interval: 2000 } }, max: 50 });
const noAutosave = pages({ drafts: { autosave: false }, max: 50 });
const plain = pages(false);

const base = {
	title: 'Test admin',
	branding: { colors: {} },
	user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
	nav: [{ slug: 'pages', label: 'Pages' }],
	globals: [],
};

const edit = (collection: ClientCollection, extra: object = {}, update = true): AdminData =>
	({
		...base,
		route: { view: 'edit', collection: 'pages', id: 'p1' },
		collection,
		permissions: { create: true, update, delete: true },
		doc: { id: 'p1', title: 'Hello', _status: 'draft', updatedAt: '2026-01-02T03:04:05Z' },
		hiddenFields: [],
		isSelf: false,
		...extra,
	}) as AdminData;

describe('drafts: edit view', () => {
	it('shows Publish first, Save draft as a named submitter, the status badge and Versions', () => {
		const { body } = render(Admin, { props: { data: edit(withAutosave, { status: 'changed', versionCount: 4 }) } });
		const publish = body.indexOf('>Publish<');
		const draft = body.indexOf('name="__draft"');
		expect(publish).toBeGreaterThan(-1);
		expect(draft).toBeGreaterThan(publish);
		expect(body).toContain('Save draft');
		expect(body).toContain('data-testid="doc-status"');
		expect(body).toContain('Published, with draft changes');
		expect(body).toMatch(/href="[^"]*\/admin\/collections\/pages\/p1\/versions"/);
		expect(body).toContain('Versions (4)');
		expect(body).toContain('action="?/unpublish"');
		expect(body).toContain('form="kc-unpublish"');
		expect(body).toContain('aria-live="polite"');
		expect(body).toContain('data-testid="autosave"');
	});

	it('a draft has no Unpublish; a collection without autosave has no live region', () => {
		const { body } = render(Admin, { props: { data: edit(noAutosave, { status: 'draft' }) } });
		expect(body).not.toContain('kc-unpublish');
		expect(body).not.toContain('data-testid="autosave"');
		expect(body).toContain('>Draft<');
		expect(body).toContain('name="__draft"');
	});

	it('create offers Publish and Save draft but no autosave', () => {
		const data = {
			...base,
			route: { view: 'create', collection: 'pages' },
			collection: withAutosave,
			permissions: { create: true, update: true, delete: true },
			doc: {},
		} as AdminData;
		const { body } = render(Admin, { props: { data } });
		expect(body).toContain('>Publish<');
		expect(body).toContain('Save draft');
		expect(body).not.toContain('data-testid="autosave"');
		expect(body).not.toContain('doc-status');
	});

	it('collections without drafts keep a single Save button', () => {
		const { body } = render(Admin, { props: { data: edit(plain, { versionCount: 2 }) } });
		expect(body).toContain('>Save<');
		expect(body).not.toContain('__draft');
		expect(body).not.toContain('Publish');
		expect(body).toContain('Versions (2)');
	});

	it('read-only users get no draft buttons or Unpublish', () => {
		const { body } = render(Admin, { props: { data: edit(withAutosave, { status: 'published' }, false) } });
		expect(body).not.toContain('Save draft');
		expect(body).not.toContain('kc-unpublish');
		expect(body).not.toContain('data-testid="autosave"');
	});
});

describe('drafts: list and versions views', () => {
	it('renders a status badge column', () => {
		const data = {
			...base,
			route: { view: 'list', collection: 'pages' },
			collection: withAutosave,
			permissions: { create: true, update: true, delete: true },
			query: { page: 1, limit: 25, sort: '-createdAt', q: '' },
			docs: [
				{ id: 'a', title: 'A', _status: 'published' },
				{ id: 'b', title: 'B', _status: 'draft' },
			],
			totalDocs: 2,
			totalPages: 1,
		} as AdminData;
		const { body } = render(Admin, { props: { data } });
		expect(body).toMatch(/>\s*Status\s*</);
		expect(body.match(/data-testid="status"/g)).toHaveLength(2);
		expect(body).toContain('>Published<');
		expect(body).toContain('>Draft<');
	});

	const versionsData = (collection: ClientCollection, route: object): AdminData =>
		({
			...base,
			route,
			collection,
			permissions: { create: false, update: true, delete: false },
			docTitle: 'Hello',
			versions: [
				{ id: 'v2', status: 'draft', autosave: true, latest: true, createdAt: '2026-01-02T03:04:05Z', label: 'Hello 2' },
				{ id: 'v1', status: 'published', autosave: false, latest: false, createdAt: '2026-01-01T03:04:05Z', label: 'Hello' },
			],
			totalDocs: 2,
			page: 1,
			totalPages: 1,
		}) as AdminData;

	it('renders versions with restore buttons', () => {
		const { body } = render(Admin, {
			props: { data: versionsData(withAutosave, { view: 'versions', collection: 'pages', id: 'p1' }) },
		});
		expect(body).toContain('Versions of Hello');
		expect(body).toContain('data-version-id="v2"');
		expect(body).toContain('Autosave');
		expect(body).toContain('Latest');
		expect(body).toContain('action="?/restoreVersion"');
		expect(body).toContain('name="__versionId"');
		expect(body).toContain('Restore as draft');
		expect(body).toContain('Restore and publish');
		expect(body).toMatch(/href="[^"]*\/admin\/collections\/pages\/p1"/);
	});

	it('renders global versions, with a single Restore without drafts', () => {
		const g = { ...plain, kind: 'global', slug: '_global_site', globalSlug: 'site' } as ClientCollection;
		const { body } = render(Admin, { props: { data: versionsData(g, { view: 'versions', global: 'site' }) } });
		expect(body).toContain('>Restore<');
		expect(body).not.toContain('Restore as draft');
		expect(body).toMatch(/href="[^"]*\/admin\/globals\/site"/);
	});

	it('hides restore without update permission', () => {
		const data = versionsData(withAutosave, { view: 'versions', collection: 'pages', id: 'p1' });
		(data as { permissions: { update: boolean } }).permissions.update = false;
		const { body } = render(Admin, { props: { data } });
		expect(body).not.toContain('restoreVersion');
	});
});
