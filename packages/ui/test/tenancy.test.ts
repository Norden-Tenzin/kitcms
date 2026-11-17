import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Admin from '../src/lib/Admin.svelte';
import type { AdminData, ClientCollection } from '@kitcms/core/client';

const text = (name: string) => ({
	type: 'text',
	name,
	label: name[0]!.toUpperCase() + name.slice(1),
	required: false,
	index: false,
	unique: false,
	admin: {},
});
const rel = (name: string) => ({ ...text(name), type: 'relationship', relationTo: 'vendors', label: 'Vendor' });

const col = (slug: string, fields: unknown[], columns: string[]) =>
	({
		kind: 'collection',
		slug,
		labels: { singular: 'Room', plural: 'Rooms' },
		fields,
		layout: fields.map((f) => ({ kind: 'field', name: (f as { name: string }).name })),
		admin: { useAsTitle: 'name', defaultColumns: columns, listSearchableFields: [], hidden: false },
		defaultSort: '-createdAt',
		upload: false,
		auth: false,
		orderable: false,
		versions: false,
		access: {},
		hooks: {},
	}) as unknown as ClientCollection;

const rooms = col('rooms', [text('name'), rel('tenant')], ['name']);
const A = { id: 'va', title: 'Vendor A' };
const B = { id: 'vb', title: 'Vendor B' };
const tenancy = (over: object = {}) => ({
	current: null,
	field: 'tenant',
	scoped: ['rooms'],
	tenants: [A, B],
	canSelectAll: true,
	...over,
});

const base = {
	title: 'Test admin',
	branding: { colors: {} },
	user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
	nav: [{ slug: 'rooms', label: 'Rooms' }],
	globals: [],
};
const dashboard = (t: unknown): AdminData =>
	({ ...base, tenancy: t, route: { view: 'dashboard' }, collections: [], globals: [] }) as unknown as AdminData;
const list = (t: unknown): AdminData =>
	({
		...base,
		tenancy: t,
		route: { view: 'list', collection: 'rooms' },
		collection: rooms,
		permissions: { create: true, update: true, delete: false },
		query: { page: 1, limit: 25, sort: 'name', q: '' },
		docs: [{ id: 'r1', name: 'Room 1', tenant: 'vb' }],
		totalDocs: 1,
		totalPages: 1,
	}) as unknown as AdminData;
const create = (t: unknown, collection = rooms): AdminData =>
	({
		...base,
		tenancy: t,
		route: { view: 'create', collection: collection.slug },
		collection,
		permissions: { create: true, update: true, delete: false },
		doc: {},
	}) as unknown as AdminData;

const html = (data: AdminData) => render(Admin, { props: { data } }).body;

describe('tenant switcher', () => {
	it('renders every tenant plus "All tenants" for an all-tenants user, current selected', () => {
		const body = html(dashboard(tenancy({ current: 'vb' })));
		expect(body).toContain('action="?/setTenant"');
		expect(body).toContain('name="tenant"');
		expect(body).toContain('All tenants');
		expect(body).toContain('Vendor A');
		expect(body).toMatch(/<option value="vb" selected[^>]*>Vendor B/);
	});

	it('has no "All tenants" option for a tenant user with several tenants', () => {
		const body = html(dashboard(tenancy({ current: 'va', canSelectAll: false })));
		expect(body).toContain('name="tenant"');
		expect(body).not.toContain('All tenants');
	});

	it('shows a single tenant as plain text, without a form', () => {
		const body = html(dashboard(tenancy({ current: 'va', canSelectAll: false, tenants: [A] })));
		expect(body).not.toContain('setTenant');
		expect(body).toContain('data-testid="tenant-name"');
		expect(body).toContain('Vendor A');
	});

	it('renders nothing without tenancy', () => {
		expect(html(dashboard(null))).not.toContain('setTenant');
	});
});

describe('tenant field and column', () => {
	it('hides the tenant field on create while a tenant is selected', () => {
		const body = html(create(tenancy({ current: 'va' })));
		expect(body).toContain('name="name"');
		expect(body.match(/name="tenant"/g)?.length ?? 0).toBe(1); // only the header switcher
	});

	it('shows the tenant field on create when all tenants are selected', () => {
		const body = html(create(tenancy({ current: null })));
		expect(body.match(/name="tenant"/g)?.length ?? 0).toBeGreaterThan(1);
	});

	it('keeps the field on collections that are not tenant-scoped', () => {
		const body = html(create(tenancy({ current: 'va', scoped: [] })));
		expect(body.match(/name="tenant"/g)?.length ?? 0).toBeGreaterThan(1);
	});

	it('adds the tenant column (with the tenant title) on the list when all tenants are selected', () => {
		const body = html(list(tenancy({ current: null })));
		expect(body).toContain('data-testid="tenant-cell"');
		expect(body).toMatch(/data-testid="tenant-cell">Vendor B</);
	});

	it('has no tenant column when a tenant is selected', () => {
		expect(html(list(tenancy({ current: 'va' })))).not.toContain('tenant-cell');
	});
});
