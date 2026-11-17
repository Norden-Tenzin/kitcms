import { expect, test } from '@playwright/test';
import { hydrated, idFromUrl, uid } from './helpers';

test('versions list shows each save and restore brings an old title back', async ({ page }) => {
	const first = uid('E2E v1');
	const second = `${first} v2`;

	await page.goto('/admin/collections/pages/create');
	await hydrated(page);
	await page.getByLabel('Title').first().fill(first);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page).toHaveURL(/\/collections\/pages\/(?!create)[^/]+$/);
	const id = idFromUrl(page.url(), 'pages');

	await hydrated(page);
	await page.getByLabel('Title').first().fill(second);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: second })).toBeVisible();

	await page.getByRole('link', { name: /^Versions \(/ }).click();
	await expect(page).toHaveURL(new RegExp(`/pages/${id}/versions$`));
	const rows = page.locator('tbody tr[data-version-id]');
	await expect(rows).toHaveCount(2);
	await expect(rows.first()).toContainText('Latest');
	await expect(rows.first()).toContainText(second);
	await expect(rows.nth(1)).toContainText(first);

	// Restore the older version and publish it.
	await rows.nth(1).getByRole('button', { name: 'Restore and publish' }).click();
	await page.goto(`/admin/collections/pages/${id}`);
	await expect(page.getByLabel('Title').first()).toHaveValue(first);
	await expect(page.getByTestId('doc-status')).toHaveText('Published');

	// The restore itself is a new version.
	await page.goto(`/admin/collections/pages/${id}/versions`);
	await expect(page.locator('tbody tr[data-version-id]')).toHaveCount(3);
});
