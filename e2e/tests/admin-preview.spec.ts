import { expect, test } from '@playwright/test';
import { hydrated, uid } from './helpers';

test('live preview follows what is typed into a hero block', async ({ page }) => {
	await page.goto('/admin/collections/pages/create');
	await hydrated(page);
	await page.getByLabel('Title').first().fill(uid('E2E preview'));

	// No block with a preview yet: no preview pane.
	await expect(page.getByTestId('preview-pane')).toHaveCount(0);

	await page.getByRole('button', { name: 'Add block' }).click();
	await page.getByRole('menuitem', { name: /Hero/ }).click();
	const pane = page.getByTestId('preview-pane');
	await expect(pane).toBeVisible();

	const heading = page.locator('input[name="sections.0.heading"]');
	await heading.fill('First headline');
	await expect(pane.getByRole('heading', { level: 1, name: 'First headline' })).toBeVisible();

	await heading.fill('Second headline');
	await expect(pane.getByRole('heading', { level: 1, name: 'Second headline' })).toBeVisible();
	await expect(pane.getByRole('heading', { name: 'First headline' })).toHaveCount(0);

	await page.locator('textarea[name="sections.0.subheading"]').fill('A sub line');
	await expect(pane.getByText('A sub line')).toBeVisible();

	// The toggle hides and shows the pane.
	await page.getByTestId('preview-toggle').click();
	await expect(pane).toHaveCount(0);
	await page.getByTestId('preview-toggle').click();
	await expect(pane).toBeVisible();
});
