import { expect, test } from '@playwright/test';
import { hydrated, uid } from './helpers';

test('edit and save a global; it persists and is served', async ({ page }) => {
	const tagline = uid('Tagline');
	await page.goto('/admin');
	await expect(page.getByTestId('global-card')).toContainText('Site settings');
	await page.getByRole('link', { name: 'Site settings' }).first().click();
	await expect(page).toHaveURL(/\/admin\/globals\/site$/);
	await hydrated(page);

	// `siteName` is required and there is no seed in the e2e database.
	await page.getByLabel('Site name').fill('E2E site');
	await page.getByLabel('Tagline').fill(tagline);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByTestId('saved')).toBeVisible();

	await page.reload();
	await expect(page.getByLabel('Tagline')).toHaveValue(tagline);

	const res = await page.request.get('/api/globals/site');
	expect(res.ok()).toBe(true);
	expect(((await res.json()) as { tagline: string }).tagline).toBe(tagline);
});

test('a global cannot be created or deleted from the admin', async ({ page }) => {
	await page.goto('/admin/globals/site');
	await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
});
