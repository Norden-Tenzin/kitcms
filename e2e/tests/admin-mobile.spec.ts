/// <reference lib="dom" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { hydrated, PNG_1X1, uid } from './helpers';

// Responsive audit of the admin: no page-level horizontal scroll, a working nav menu on small
// screens, and screenshots (e2e/screenshots/<size>-<view>.png) to look at.
test.describe.configure({ mode: 'serial' });

const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');
const SIZES = [
	{ name: '360', width: 360, height: 740 },
	{ name: '768', width: 768, height: 1024 },
	{ name: '1280', width: 1280, height: 800 },
] as const;

async function noHorizontalScroll(page: Page) {
	const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
	let culprits = '';
	if (scrollWidth > innerWidth) {
		culprits = await page.evaluate(() =>
			[...document.querySelectorAll('body *')]
				.filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
				.slice(0, 6)
				.map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
				.join(' | '),
		);
	}
	expect(scrollWidth, `page scrolls horizontally; wider than the viewport: ${culprits}`).toBeLessThanOrEqual(innerWidth);
}

async function shot(page: Page, size: string, name: string) {
	await page.screenshot({ path: path.join(SHOTS, `${size}-${name}.png`), fullPage: true });
	await noHorizontalScroll(page);
}

const filename = `${uid('mobile-image').replaceAll(' ', '-')}.png`;
const title = uid('Mobile page');

test('seed: an upload and a page with blocks', async ({ page }) => {
	await page.goto('/admin/collections/media');
	await hydrated(page);
	await page.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: 'image/png', buffer: PNG_1X1 });
	await expect(page.getByRole('list', { name: 'Media' }).getByText(filename)).toBeVisible();

	await page.goto('/admin/collections/pages/create');
	await hydrated(page);
	await page.getByLabel('Title').first().fill(title);
	await page.getByRole('button', { name: 'Add block' }).click();
	await page.getByRole('menuitem', { name: /Hero/ }).click();
	await page.locator('input[name="sections.0.heading"]').fill('A rather long headline for a mobile hero block');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page).toHaveURL(/\/collections\/pages\/(?!create)[^/]+$/);
});

for (const size of SIZES) {
	test.describe(`at ${size.name}px`, () => {
		test.use({ viewport: { width: size.width, height: size.height } });
		const mobile = size.width <= 800;

		test('dashboard + nav menu', async ({ page }) => {
			await page.goto('/admin');
			await hydrated(page);
			const menu = page.getByRole('button', { name: 'Menu', exact: true });
			const nav = page.getByRole('navigation', { name: 'Main' });
			if (mobile) {
				await expect(menu).toBeVisible();
				await expect(menu).toHaveAttribute('aria-expanded', 'false');
				await expect(nav).toBeHidden();
				await menu.click();
				await expect(menu).toHaveAttribute('aria-expanded', 'true');
				await expect(nav).toBeVisible();
				await shot(page, size.name, 'dashboard-menu-open');
				await page.keyboard.press('Escape');
				await expect(menu).toHaveAttribute('aria-expanded', 'false');
				await expect(nav).toBeHidden();
				await expect(menu).toBeFocused();
				const box = await menu.boundingBox();
				expect(box!.height).toBeGreaterThanOrEqual(44);
				expect(box!.width).toBeGreaterThanOrEqual(44);
			} else {
				await expect(menu).toBeHidden();
				await expect(nav).toBeVisible();
			}
			await shot(page, size.name, 'dashboard');
		});

		test('list view', async ({ page }) => {
			await page.goto('/admin/collections/pages');
			await hydrated(page);
			await expect(page.getByText(title).first()).toBeVisible();
			await shot(page, size.name, 'list-pages');
		});

		test('edit view with blocks', async ({ page }) => {
			await page.goto('/admin/collections/pages');
			await hydrated(page);
			await page.getByRole('link', { name: title }).first().click();
			await expect(page.locator('input[name="sections.0.heading"]')).toBeVisible();
			await hydrated(page);
			await shot(page, size.name, 'edit-blocks');
		});

		test('media picker', async ({ page }) => {
			await page.goto('/admin/collections/pages/create');
			await hydrated(page);
			await page.locator('[data-path="cover"]').getByRole('button', { name: 'Browse library' }).click();
			const dialog = page.getByRole('dialog', { name: 'Media library' });
			await expect(dialog).toBeVisible();
			await expect(dialog.getByRole('button', { name: new RegExp(filename.replace('.', '\\.')) })).toBeVisible();
			const box = await dialog.boundingBox();
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.y).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
			expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
			await page.screenshot({ path: path.join(SHOTS, `${size.name}-media-picker.png`) });
			await noHorizontalScroll(page);
		});

		test('site settings global', async ({ page }) => {
			await page.goto('/admin/globals/site');
			await hydrated(page);
			await shot(page, size.name, 'global-site');
		});

		test('live preview toggle', async ({ page }) => {
			await page.goto('/admin/collections/pages/create');
			await hydrated(page);
			await page.getByRole('button', { name: 'Add block' }).click();
			await page.getByRole('menuitem', { name: /Hero/ }).click();
			await page.locator('input[name="sections.0.heading"]').fill('Preview me');
			const pane = page.getByTestId('preview-pane');
			if (mobile) {
				// Collapsed by default on small screens; the toggle shows it full width.
				await expect(pane).toHaveCount(0);
				await page.getByTestId('preview-toggle').click();
			}
			await expect(pane).toBeVisible();
			await expect(pane.getByRole('heading', { name: 'Preview me' })).toBeVisible();
			if (mobile) {
				const box = await pane.boundingBox();
				expect(box!.width).toBeGreaterThan(size.width * 0.85);
			}
			await shot(page, size.name, 'edit-preview');
		});
	});
}

test.describe('login at 320px', () => {
	test.use({ viewport: { width: 320, height: 640 }, storageState: { cookies: [], origins: [] } });
	test('fits without horizontal scroll', async ({ page }) => {
		await page.goto('/admin');
		await expect(page.getByRole('button', { name: /log ?in|sign ?in/i })).toBeVisible();
		await shot(page, '320', 'login');
	});
});
