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
	branding: { colors: {} },
	user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
	nav: [{ slug: 'posts', label: 'Posts' }],
	globals: [{ slug: 'site', label: 'Site settings' }],
};

const site = {
	...posts,
	kind: 'global',
	slug: '_global_site',
	globalSlug: 'site',
	labels: { singular: 'Site settings', plural: 'Site settings' },
	fields: [text('siteName', { required: true })],
	layout: [{ kind: 'field', name: 'siteName' }],
	admin: { useAsTitle: 'id', defaultColumns: [], listSearchableFields: [], hidden: false },
} as unknown as ClientCollection;

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

describe('globals (SSR smoke)', () => {
	const globalData = (update = true): AdminData => ({
		...base,
		route: { view: 'global', global: 'site' },
		collection: site,
		permissions: { create: false, update, delete: false },
		doc: { id: 'site', siteName: 'Hotel', updatedAt: '2026-01-02T03:04:05Z' },
		hiddenFields: [],
	});

	it('renders the global edit view without delete, and the nav section', () => {
		const { body } = render(Admin, { props: { data: globalData() } });
		expect(body).toContain('value="Hotel"');
		expect(body).toContain('action="?/save"');
		expect(body).not.toContain('action="?/delete"');
		expect(body).toContain('Globals');
		expect(body).toContain('/admin/globals/site');
		expect(body).toContain('aria-current="page"');
		expect(body).not.toContain('New');
	});

	it('is read-only without update permission', () => {
		const { body } = render(Admin, { props: { data: globalData(false) } });
		expect(body).toContain('view this global but not change it');
	});

	it('lists globals on the dashboard', () => {
		const data: AdminData = {
			...base,
			route: { view: 'dashboard' },
			collections: [{ slug: 'posts', label: 'Posts', totalDocs: 2 }],
			globals: [{ slug: 'site', label: 'Site settings', description: 'Global things' }],
		};
		const { body } = render(Admin, { props: { data } });
		expect(body).toContain('data-testid="global-card"');
		expect(body).toContain('Global things');
	});

	it('links references from a global to it, labelled', () => {
		const { body } = render(Admin, {
			props: {
				data: globalData(),
				form: { message: 'In use', references: [{ collection: '_global_site', id: 'site', path: 'logo' }] },
			},
		});
		expect(body).toContain('data-testid="references"');
		expect(body).toMatch(/<a href="[^"]*\/admin\/globals\/site">Site settings<\/a>/);
	});
});

describe('admin branding (SSR smoke)', () => {
	const listData = (branding: AdminData['branding']): AdminData => ({
		...base,
		branding,
		route: { view: 'list', collection: 'posts' },
		collection: posts,
		permissions: { create: true, update: true, delete: true },
		query: { page: 1, limit: 25, sort: 'title', q: '' },
		docs: [],
		totalDocs: 0,
		totalPages: 1,
	});
	const rootStyle = (body: string) => body.match(/<div class="kitcms-admin"[^>]*>/)?.[0] ?? '';

	it('sets accent CSS variables inline on the admin root', () => {
		const { body } = render(Admin, {
			props: { data: listData({ colors: { accent: '#ff0066', accentText: '#101010' } }) },
		});
		const root = rootStyle(body);
		expect(root).toContain('--kc-accent: #ff0066');
		expect(root).toContain('--kc-accent-text: #101010');
	});

	it('sets only the variables that are configured', () => {
		const { body } = render(Admin, { props: { data: listData({ colors: { accent: '#ff0066' } }) } });
		const root = rootStyle(body);
		expect(root).toContain('--kc-accent: #ff0066');
		expect(root).not.toContain('--kc-accent-text');
	});

	it('renders the logo in the header next to the title', () => {
		const { body } = render(Admin, {
			props: { data: listData({ logo: 'https://cdn.example.com/logo.svg', colors: {} }) },
		});
		// Svelte adds scoped class hashes and hydration comments, so match loosely.
		expect(body).toMatch(
			/<a class="brand[^"]*"[^>]*>(?:<!--[^>]*-->)*<img class="logo[^"]*" src="https:\/\/cdn\.example\.com\/logo\.svg" alt="Test admin"\/>(?:<!--[^>]*-->)*\s*Test admin<\/a>/,
		);
	});

	it('renders no inline variables and no logo without branding', () => {
		const { body } = render(Admin, { props: { data: listData({ colors: {} }) } });
		expect(rootStyle(body)).not.toContain('--kc-');
		expect(body).not.toContain('<img');
		expect(body).toMatch(/<a class="brand[^"]*"/);
	});

	it('shows the logo on the login and first-user pages', () => {
		const branding = { logo: 'https://cdn.example.com/logo.svg', colors: {} };
		const logo = /<img class="logo[^"]*" src="https:\/\/cdn\.example\.com\/logo\.svg"/;
		const login = render(Admin, {
			props: { data: { title: 'Test admin', branding, route: { view: 'login' } } as AdminData },
		});
		expect(login.body).toMatch(logo);
		const first = render(Admin, {
			props: { data: { title: 'Test admin', branding, route: { view: 'create-first-user' } } as AdminData },
		});
		expect(first.body).toMatch(logo);
	});

	it('shows no logo on the login page without branding', () => {
		const login = render(Admin, {
			props: { data: { title: 'Test admin', branding: { colors: {} }, route: { view: 'login' } } as AdminData },
		});
		expect(login.body).not.toContain('<img');
		expect(login.body).not.toContain('--kc-');
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
