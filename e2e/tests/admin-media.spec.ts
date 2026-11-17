import { expect, test } from '@playwright/test';
import { hydrated, idFromUrl, PNG_1X1, uid } from './helpers';

test.describe.configure({ mode: 'serial' });

const filename = `${uid('e2e-image').replaceAll(' ', '-')}.png`;
const title = uid('E2E with cover');

test('upload an image in the media library', async ({ page }) => {
	await page.goto('/admin/collections/media');
	await hydrated(page);
	const uploaded = page.waitForResponse((r) => r.url().includes('/api/upload/media') && r.request().method() === 'POST');
	await page.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: 'image/png', buffer: PNG_1X1 });
	expect((await uploaded).status()).toBe(201);
	await expect(page.getByRole('list', { name: 'Media' }).getByText(filename)).toBeVisible();
});

test('a non-image file type that is not allowed is rejected client-side', async ({ page }) => {
	await page.goto('/admin/collections/media');
	await hydrated(page);
	await page.locator('input[type="file"]').setInputFiles({ name: 'evil.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
	await expect(page.getByText(/is not allowed/)).toBeVisible();
	await expect(page.getByRole('list', { name: 'Media' }).getByText('evil.exe')).toHaveCount(0);
});

test('pick the upload in a page cover field and keep it after saving', async ({ page }) => {
	await page.goto('/admin/collections/pages/create');
	await hydrated(page);
	await page.getByLabel('Title').first().fill(title);

	const cover = page.locator('[data-path="cover"]');
	await cover.getByRole('button', { name: 'Browse library' }).click();
	const dialog = page.getByRole('dialog', { name: 'Media library' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: new RegExp(filename.replace('.', '\\.')) }).click();
	await dialog.getByRole('button', { name: 'Confirm' }).click();
	await expect(dialog).toBeHidden();
	await expect(cover.getByRole('list', { name: /Selected/ })).toContainText(filename);

	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page).toHaveURL(/\/collections\/pages\/(?!create)[^/]+$/);
	const id = idFromUrl(page.url(), 'pages');

	await page.goto(`/admin/collections/pages/${id}`);
	await expect(page.locator('[data-path="cover"]').getByRole('list', { name: /Selected/ })).toContainText(filename);
	await expect(page.locator('[data-path="cover"] img')).toBeVisible();
});

test('the uploaded file is served', async ({ page }) => {
	await page.goto('/admin/collections/media');
	const href = await page.getByRole('list', { name: 'Media' }).getByRole('link', { name: new RegExp(filename.replace('.', '\\.')) }).first().getAttribute('href');
	const id = idFromUrl(href!, 'media');
	const res = await page.request.get(`/api/collections/media/${id}`);
	expect(res.ok()).toBe(true);
	const doc = (await res.json()) as { url: string; mimeType: string };
	expect(doc.mimeType).toBe('image/png');
	const file = await page.request.get(doc.url);
	expect(file.status()).toBe(200);
	expect(file.headers()['content-type']).toContain('image/png');
});
