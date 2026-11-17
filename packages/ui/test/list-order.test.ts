import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Admin from '../src/lib/Admin.svelte';
import type { AdminData, ClientCollection } from '@kitcms/core/client';

const team = {
	slug: 'team',
	labels: { singular: 'Member', plural: 'Team' },
	fields: [{ type: 'text', name: 'name', label: 'Name', required: true, index: false, unique: false, admin: {} }],
	layout: [{ kind: 'field', name: 'name' }],
	admin: { useAsTitle: 'name', defaultColumns: ['name'], listSearchableFields: ['name'], hidden: false, locked: false },
	defaultSort: '_order',
	orderable: true,
	upload: false,
	auth: false,
	access: {},
	hooks: {},
} as unknown as ClientCollection;

const docs = [
	{ id: 'm1', name: 'Ada', _order: 'a0' },
	{ id: 'm2', name: 'Grace', _order: 'a1' },
	{ id: 'm3', name: 'Alan', _order: 'a2' },
];

function list(over: Partial<Extract<AdminData, { route: { view: 'list' } }>> & { collection?: ClientCollection } = {}) {
	const data = {
		title: 'Test admin',
		branding: { colors: {} },
		user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
		nav: [],
		globals: [],
		route: { view: 'list', collection: 'team' },
		collection: team,
		permissions: { create: true, update: true, delete: true },
		query: { page: 1, limit: 25, sort: '_order', q: '' },
		docs,
		totalDocs: 3,
		totalPages: 1,
		...over,
	} as unknown as AdminData;
	return render(Admin, { props: { data } }).body;
}

describe('orderable list', () => {
	it('shows drag handles and no-JS move buttons when sorted by _order', () => {
		const body = list();
		expect(body).toContain('draggable="true"');
		expect(body.match(/draggable="true"/g)).toHaveLength(3);
		expect(body).toContain('action="?/move&amp;page=1&amp;limit=25"');
		expect(body).toContain('Move down');
		expect(body).toContain('Move up');
	});

	it('hides handles when sorted otherwise, searching, or without update permission', () => {
		expect(list({ query: { page: 1, limit: 25, sort: 'name', q: '' } })).not.toContain('draggable="true"');
		expect(list({ query: { page: 1, limit: 25, sort: '-_order', q: '' } })).not.toContain('draggable="true"');
		expect(list({ query: { page: 1, limit: 25, sort: '_order', q: 'ad' } })).not.toContain('draggable="true"');
		expect(list({ permissions: { create: true, update: false, delete: true } })).not.toContain('draggable="true"');
	});

	it('locked collections show a badge and no create/delete controls', () => {
		const locked = { ...team, admin: { ...team.admin, locked: true }, orderable: false } as ClientCollection;
		const body = list({ collection: locked, permissions: { create: false, update: true, delete: false } });
		expect(body).toContain('Locked');
		expect(body).not.toContain('Create new');
		expect(body).not.toContain('?/bulkDelete');
	});
});
