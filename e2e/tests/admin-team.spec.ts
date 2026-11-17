import { expect, test } from '@playwright/test';
import { hydrated, uid } from './helpers';

// The orderable `team` collection: reorder with the keyboard handle and check it persists.
test.describe.configure({ mode: 'serial' });

const run = uid('T').replace(' ', '-');
const names = [`${run}-first`, `${run}-second`, `${run}-third`];

/** The e2e members, in the order the list shows them. */
async function order(page: import('@playwright/test').Page): Promise<string[]> {
	const cells = await page.locator('tbody tr td a').allTextContents();
	return cells.filter((t) => t.startsWith(run));
}

test('create three team members', async ({ page }) => {
	for (const name of names) {
		await page.goto('/admin/collections/team/create');
		await hydrated(page);
		await page.getByLabel('Name').fill(name);
		await page.getByRole('button', { name: 'Create' }).click();
		await expect(page).toHaveURL(/\/collections\/team\/(?!create)[^/]+$/);
	}
	await page.goto('/admin/collections/team');
	expect(await order(page)).toEqual(names);
});

test('reordering with the keyboard persists after a reload', async ({ page }) => {
	await page.goto('/admin/collections/team?sort=_order');
	await hydrated(page);
	// Move the third member up twice.
	for (let i = 0; i < 2; i++) {
		const handle = page.getByRole('button', { name: new RegExp(`Reorder ${names[2]}`) });
		const moved = page.waitForResponse((r) => r.url().includes('/move') && r.request().method() === 'POST');
		await handle.focus();
		await page.keyboard.press('ArrowUp');
		expect((await moved).ok()).toBe(true);
		await expect.poll(async () => (await order(page)).indexOf(names[2]!)).toBe(1 - i);
	}
	const expected = [names[2]!, names[0]!, names[1]!];
	await expect.poll(() => order(page)).toEqual(expected);

	await page.reload();
	await hydrated(page);
	expect(await order(page)).toEqual(expected);

	// The public API returns them in that order too.
	const res = await page.request.get('/api/collections/team?limit=100');
	const { docs } = (await res.json()) as { docs: { name: string }[] };
	expect(docs.map((d) => d.name).filter((n) => n.startsWith(run))).toEqual(expected);
});

test('the reorder handle is not offered when the list is sorted differently', async ({ page }) => {
	await page.goto('/admin/collections/team?sort=name');
	await expect(page.getByRole('button', { name: /^Reorder / })).toHaveCount(0);
});
