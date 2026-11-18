import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Admin from '../src/lib/Admin.svelte';
import { formatBytes } from '../src/lib/format';
import type { AdminData, AdminDataOf } from '@kitcms/core/client';

type PanelBlock = AdminDataOf<'panel'>['panel']['content']['blocks'][number];

const base = {
	title: 'Test admin',
	branding: { colors: {} },
	user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
	nav: [],
	globals: [],
	panels: [
		{ plugin: 'entitlements', id: 'plan', label: 'Plan & add-ons' },
		{ plugin: 'enquiries', id: 'stats', label: 'Enquiry stats', group: 'Sales' },
	],
};

function panel(blocks: PanelBlock[], route = { plugin: 'entitlements', panel: 'plan' }) {
	const data = { ...base, route: { view: 'panel', ...route }, panel: { label: 'Plan & add-ons', content: { blocks } } };
	return render(Admin, { props: { data: data as unknown as AdminData } }).body;
}

describe('formatBytes', () => {
	it('formats units', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(1023)).toBe('1023 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
		expect(formatBytes(3 * 1024 ** 3)).toBe('3 GB');
	});
});

describe('plugin panels', () => {
	it('adds nav entries (ungrouped under Plugins, grouped under their group) and marks the active one', () => {
		const body = panel([]);
		expect(body).toContain('href="/admin/plugins/entitlements/plan"');
		expect(body).toContain('href="/admin/plugins/enquiries/stats"');
		expect(body).toContain('Plugins');
		expect(body).toContain('Sales');
		expect(body).toMatch(/href="\/admin\/plugins\/entitlements\/plan"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/admin\/plugins\/entitlements\/plan"/);
		expect(body).toContain('<h1>Plan &amp; add-ons</h1>');
	});

	it('renders heading, text with tone and keyValue as text', () => {
		const body = panel([
			{ type: 'heading', text: 'Plan' },
			{ type: 'text', text: '<script>alert(1)</script>', tone: 'warning' },
			{ type: 'keyValue', items: [{ label: 'Plan', value: 'Pro', tone: 'ok' }] },
		]);
		expect(body).toMatch(/<h2[^>]*>Plan<\/h2>/);
		expect(body).toContain('tone-warning');
		expect(body).not.toContain('<script>alert');
		expect(body).toContain('&lt;script>');
		expect(body).toMatch(/<dt[^>]*>Plan<\/dt>/);
		expect(body).toContain('tone-ok');
	});

	it('renders meters with a role, bytes formatting and Unlimited', () => {
		const body = panel([
			{ type: 'meter', label: 'Uploads', used: 1536, limit: 10 * 1024 * 1024, unit: 'bytes' },
			{ type: 'meter', label: 'Pages', used: 12, limit: null, unit: 'documents' },
		]);
		expect(body).toContain('role="meter"');
		expect(body).toContain('aria-valuenow="1536"');
		expect(body).toContain('1.5 KB of 10 MB');
		expect(body).toContain('12 documents');
		expect(body).toContain('Unlimited');
		expect(body.match(/role="meter"/g)).toHaveLength(1);
	});

	it('renders list statuses, with a lock for locked items', () => {
		const body = panel([
			{
				type: 'list',
				items: [
					{ label: 'Enquiries', description: 'Contact forms', status: 'on' },
					{ label: 'Blog', status: 'off' },
					{ label: 'Bookings', status: 'locked' },
				],
			},
		]);
		expect(body).toContain('Contact forms');
		expect(body).toContain('data-status="on"');
		expect(body).toContain('data-status="off"');
		expect(body).toContain('data-status="locked"');
		expect(body).toContain('Locked');
		expect(body).toContain('🔒');
	});

	it('renders links; https opens safely in a new tab, relative stays', () => {
		const body = panel([
			{ type: 'link', label: 'Manage', href: 'https://example.com/manage' },
			{ type: 'link', label: 'Docs', href: '/admin' },
		]);
		expect(body).toMatch(/href="https:\/\/example.com\/manage"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*href="https:\/\/example.com\/manage"/);
		expect(body).toContain('target="_blank"');
		expect(body.match(/target="_blank"/g)).toHaveLength(1);
	});
});
