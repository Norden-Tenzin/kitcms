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

const posts = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		text('title', { required: true }),
		{ type: 'checkbox', name: 'featured', label: 'Featured', required: false, index: false, unique: false, admin: {} },
	],
	layout: [
		{ kind: 'field', name: 'title' },
		{ kind: 'field', name: 'featured' },
	],
	admin: {
		useAsTitle: 'title',
		defaultColumns: ['title', 'featured', 'updatedAt'],
		listSearchableFields: ['title'],
		hidden: false,
	},
	defaultSort: '-createdAt',
	upload: false,
	auth: false,
	access: {},
	hooks: {},
} as unknown as ClientCollection;

const base = {
	title: 'Test admin',
	user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
	nav: [{ slug: 'posts', label: 'Posts' }],
};

describe('admin views (SSR smoke)', () => {
	it('renders the list view', () => {
		const data: AdminData = {
			...base,
			route: { view: 'list', collection: 'posts' },
			collection: posts,
			permissions: { create: true, update: true, delete: true },
			query: { page: 1, limit: 25, sort: 'title', q: '' },
			docs: [{ id: '01HZZZZZZZZZZZZZZZZZZZZZZZ', title: 'Hello', featured: true, updatedAt: '2026-01-02T03:04:05Z' }],
			totalDocs: 1,
			totalPages: 1,
		};
		const { body } = render(Admin, { props: { data } });
		expect(body).toContain('Hello');
		expect(body).toContain('✓');
		expect(body).toContain('type="search"');
		expect(body).toContain('aria-sort="ascending"');
		expect(body).toContain('Create new post');
		expect(body).toContain('aria-current="page"');
	});

	it('renders the edit view with submitted values and errors', () => {
		const data: AdminData = {
			...base,
			route: { view: 'edit', collection: 'posts', id: 'p1' },
			collection: posts,
			permissions: { create: true, update: true, delete: true },
			doc: { id: 'p1', title: 'Old', featured: false },
			hiddenFields: [],
			isSelf: false,
		};
		const { body } = render(Admin, {
			props: {
				data,
				form: { values: { title: 'Typed' }, errors: [{ path: 'title', message: 'Too short' }] },
			},
		});
		expect(body).toContain('value="Typed"');
		expect(body).toContain('Too short');
		expect(body).toContain('action="?/save"');
		expect(body).toContain('action="?/delete"');
	});

	it('renders the create view', () => {
		const data: AdminData = {
			...base,
			route: { view: 'create', collection: 'posts' },
			collection: posts,
			permissions: { create: true, update: true, delete: true },
			doc: {},
		};
		const { body } = render(Admin, { props: { data } });
		expect(body).toContain('New post');
		expect(body).not.toContain('action="?/delete"');
	});
});

describe('media library (SSR smoke)', () => {
	const media = {
		...posts,
		slug: 'media',
		labels: { singular: 'File', plural: 'Media' },
		upload: { mimeTypes: ['image/*'], maxFileSize: 1000000 },
	} as unknown as ClientCollection;
	const listData = (view?: 'grid' | 'table'): AdminData => ({
		...base,
		route: { view: 'list', collection: 'media' },
		collection: media,
		permissions: { create: true, update: true, delete: true },
		query: { page: 1, limit: 25, sort: '-createdAt', q: '', view },
		docs: [
			{ id: 'm1', filename: 'cat.png', mimeType: 'image/png', url: '/f/cat.png', filesize: 2048, width: 10, height: 20 },
			{ id: 'm2', filename: 'doc.pdf', mimeType: 'application/pdf', url: '/f/doc.pdf', filesize: 500 },
		],
		totalDocs: 2,
		totalPages: 1,
	});

	it('renders a grid with tiles linking to edit and bulk checkboxes', async () => {
		const { FORM } = await import('@kitcms/core/client');
		const { body } = render(Admin, { props: { data: listData() } });
		expect(body).toContain('media-grid');
		expect(body).toContain('/collections/media/m1');
		expect(body).toContain('cat.png');
		expect(body).toContain('10×20');
		expect(body).toContain('PDF');
		expect(body).toContain(`name="${FORM.ids}"`);
		expect(body).toContain('form="kc-bulk"');
		expect(body).toContain('kc-upload');
	});

	it('renders the table when view=table', () => {
		const { body } = render(Admin, { props: { data: listData('table') } });
		expect(body).not.toContain('media-grid');
		expect(body).toContain('<table');
	});

	it('MediaPicker renders closed and open', async () => {
		const MediaPicker = (await import('../src/lib/media/MediaPicker.svelte')).default;
		const closed = render(MediaPicker, { props: { open: false, collection: 'media', onselect: () => {} } });
		expect(closed.body).toContain('<dialog');
		expect(closed.body).not.toContain('Media library');
		const open = render(MediaPicker, { props: { open: true, collection: 'media', multiple: true, max: 3, onselect: () => {} } });
		expect(open.body).toContain('Media library');
		expect(open.body).toContain('Confirm');
		expect(open.body).toContain('aria-labelledby');
	});
});
