import { expect, test, type Page } from '@playwright/test';
import { hydrated, row, uid } from './helpers';

// Multi-tenancy (plugin-multi-tenant): `vendors` are the tenants, `rooms` are tenant-scoped. The
// admin user sees all tenants and switches between them with the header switcher.
test.describe.configure({ mode: 'serial' });

const vendorA = uid('Vendor A');
const vendorB = uid('Vendor B');
const roomA = uid('Room of A');
const roomB = uid('Room of B');

async function createVendor(page: Page, name: string, slug: string) {
	await page.goto('/admin/collections/vendors/create');
	await hydrated(page);
	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Slug').fill(slug);
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page).toHaveURL(/\/collections\/vendors\/(?!create)[^/]+$/);
}

async function switchTenant(page: Page, label: string) {
	const select = page.getByTestId('tenant-switcher').getByRole('combobox');
	const done = page.waitForResponse((r) => r.url().includes('setTenant') && r.request().method() === 'POST');
	await select.selectOption({ label });
	expect((await done).ok()).toBe(true);
	await expect(select.locator('option:checked')).toHaveText(label);
}

test('create two vendors (the tenants)', async ({ page }) => {
	await createVendor(page, vendorA, `a-${Date.now().toString(36)}`);
	await createVendor(page, vendorB, `b-${Date.now().toString(36)}`);
	await page.goto('/admin');
	await expect(page.getByTestId('tenant-switcher')).toBeVisible();
	const options = page.getByTestId('tenant-switcher').getByRole('option');
	await expect(options.filter({ hasText: vendorA })).toHaveCount(1);
	await expect(options.filter({ hasText: vendorB })).toHaveCount(1);
	await expect(options.filter({ hasText: 'All tenants' })).toHaveCount(1);
});

test('with a tenant selected, a room is created in it and the tenant field is hidden', async ({ page }) => {
	await page.goto('/admin/collections/rooms');
	await hydrated(page);
	await switchTenant(page, vendorA);

	await page.goto('/admin/collections/rooms/create');
	await hydrated(page);
	await expect(page.getByLabel('Name')).toBeVisible();
	// Inside the document form (the header switcher has its own `tenant` select).
	const form = page.locator('#kc-save');
	await expect(form.locator('[name="tenant"]')).toHaveCount(0);
	await expect(form.getByLabel('Tenant')).toHaveCount(0);
	await page.getByLabel('Name').fill(roomA);
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page).toHaveURL(/\/collections\/rooms\/(?!create)[^/]+$/);

	await page.goto('/admin/collections/rooms');
	await expect(row(page, roomA)).toHaveCount(1);
});

test('another tenant does not see the room; all tenants shows it with its tenant', async ({ page }) => {
	await page.goto('/admin/collections/rooms');
	await hydrated(page);
	await switchTenant(page, vendorB);
	await page.goto('/admin/collections/rooms');
	await expect(row(page, roomA)).toHaveCount(0);

	// Create B's room, then check isolation both ways.
	await page.goto('/admin/collections/rooms/create');
	await hydrated(page);
	await page.getByLabel('Name').fill(roomB);
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page).toHaveURL(/\/collections\/rooms\/(?!create)[^/]+$/);
	await page.goto('/admin/collections/rooms');
	await expect(row(page, roomB)).toHaveCount(1);
	await expect(row(page, roomA)).toHaveCount(0);
	await expect(page.getByTestId('tenant-cell')).toHaveCount(0);

	await switchTenant(page, vendorA);
	await page.goto('/admin/collections/rooms');
	await expect(row(page, roomA)).toHaveCount(1);
	await expect(row(page, roomB)).toHaveCount(0);

	await switchTenant(page, 'All tenants');
	await page.goto('/admin/collections/rooms');
	await expect(row(page, roomA).getByTestId('tenant-cell')).toHaveText(vendorA);
	await expect(row(page, roomB).getByTestId('tenant-cell')).toHaveText(vendorB);
});

test('the tenant selection survives a reload', async ({ page }) => {
	await page.goto('/admin/collections/rooms');
	await hydrated(page);
	await switchTenant(page, vendorB);
	await page.reload();
	await expect(page.getByTestId('tenant-switcher').getByRole('combobox').locator('option:checked')).toHaveText(vendorB);
	await expect(row(page, roomB)).toHaveCount(1);
});
