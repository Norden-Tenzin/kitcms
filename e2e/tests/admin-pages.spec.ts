import { expect, test } from '@playwright/test';
import { anonymous, hydrated, idFromUrl, row, uid } from './helpers';

// Drafts + blocks + search + delete on the `pages` collection. Shared state: one page is created,
// published, edited and deleted across the serial tests.
test.describe.configure({ mode: 'serial' });

const title = uid('E2E page');
const renamed = `${title} renamed`;
let pageId = '';

test('create a page with a hero block, save as draft', async ({ page }) => {
	await page.goto('/admin/collections/pages/create');
	await hydrated(page);
	await page.getByLabel('Title').first().fill(title);

	await page.getByRole('button', { name: 'Add block' }).click();
	await page.getByRole('menuitem', { name: /Hero/ }).click();
	await page.locator('input[name="sections.0.heading"]').fill('Welcome to e2e');

	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page).toHaveURL(/\/collections\/pages\/(?!create)[^/]+$/);
	pageId = idFromUrl(page.url(), 'pages');
	await expect(page.getByTestId('doc-status')).toHaveText('Draft');
	await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
	// The block survived the round trip.
	await expect(page.locator('input[name="sections.0.heading"]')).toHaveValue('Welcome to e2e');
});

test('publish the draft; it shows as published in the list', async ({ page }) => {
	await page.goto(`/admin/collections/pages/${pageId}`);
	await hydrated(page);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByTestId('doc-status')).toHaveText('Published');

	await page.goto('/admin/collections/pages');
	const r = row(page, title);
	await expect(r).toHaveCount(1);
	await expect(r.getByTestId('status')).toHaveText(/Published/i);
});

test('anonymous REST reads see the published page', async ({ playwright, baseURL }) => {
	const anon = await anonymous(playwright, baseURL!);
	const res = await anon.get('/api/collections/pages?limit=100');
	expect(res.ok()).toBe(true);
	const body = (await res.json()) as { docs: { title: string }[] };
	expect(body.docs.map((d) => d.title)).toContain(title);
	await anon.dispose();
});

test('edit the title and republish', async ({ page }) => {
	await page.goto(`/admin/collections/pages/${pageId}`);
	await hydrated(page);
	await page.getByLabel('Title').first().fill(renamed);
	await page.getByRole('button', { name: 'Publish', exact: true }).click();
	await expect(page.getByTestId('saved')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible();

	await page.goto('/admin/collections/pages');
	await expect(row(page, renamed)).toHaveCount(1);
});

test('list search filters by title', async ({ page }) => {
	// A second page that must NOT match the search.
	const other = uid('E2E other');
	await page.goto('/admin/collections/pages/create');
	await hydrated(page);
	await page.getByLabel('Title').first().fill(other);
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page).toHaveURL(/\/collections\/pages\/(?!create)[^/]+$/);

	await page.goto('/admin/collections/pages');
	await expect(row(page, other)).toHaveCount(1);
	await expect(row(page, renamed)).toHaveCount(1);

	await page.getByRole('searchbox', { name: 'Search' }).fill(renamed);
	await page.getByRole('button', { name: 'Search', exact: true }).click();
	await expect(page).toHaveURL(/[?&]q=/);
	await expect(row(page, renamed)).toHaveCount(1);
	await expect(row(page, other)).toHaveCount(0);
});

test('delete asks for confirmation; cancelling keeps the page, accepting deletes it', async ({ page }) => {
	await page.goto(`/admin/collections/pages/${pageId}`);
	await hydrated(page);

	const messages: string[] = [];
	page.once('dialog', (d) => {
		messages.push(d.message());
		void d.dismiss();
	});
	await page.getByRole('button', { name: 'Delete' }).click();
	await expect.poll(() => messages.length).toBe(1);
	expect(messages[0]).toMatch(/Delete this page\?/);
	await expect(page).toHaveURL(new RegExp(`/pages/${pageId}$`));

	page.once('dialog', (d) => void d.accept());
	await Promise.all([
		page.waitForURL(/\/admin\/collections\/pages(\?.*)?$/),
		page.getByRole('button', { name: 'Delete' }).click(),
	]);
	await expect(row(page, renamed)).toHaveCount(0);
	const gone = await page.request.get(`/api/collections/pages/${pageId}`);
	expect(gone.status()).toBe(404);
});
