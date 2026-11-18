// The public Dolkar House site on the built playground: home, a room page's enquiry (JS and no-JS),
// and the SEO plugin's sitemap, robots.txt and redirects. The e2e database is not seeded, so the
// content is created through the REST API as the signed-in admin.
//
// Turnstile: the build for this run sets `VITE_TURNSTILE=off` (see scripts/prepare.mjs), which leaves
// Turnstile out of the enquiry forms, so the test needs no network access to Cloudflare. Never set it in
// a real deployment.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { AUTH_FILE } from '../constants';
import { uid } from './helpers';

const ROOM = 'Orchard room';

async function create(request: APIRequestContext, baseURL: string, collection: string, data: Record<string, unknown>) {
	const res = await request.post(`/api/collections/${collection}`, {
		data: { _status: 'published', ...data },
		headers: { origin: baseURL },
	});
	expect(res.status(), await res.text()).toBe(201);
}

test.beforeAll(async ({ playwright, baseURL }) => {
	// A fresh context with the saved admin session (the project's storageState).
	const request = await playwright.request.newContext({ baseURL, storageState: AUTH_FILE });
	await create(request, baseURL!, 'pages', {
		title: 'Home',
		sections: [{ blockType: 'hero', heading: 'Slow mornings at 3,500 m', ctaLabel: 'Ask about a room', ctaHref: '/rooms' }],
	});
	await create(request, baseURL!, 'rooms', { name: ROOM, summary: 'Opens into the orchard.', priceFrom: 4200 });
	await create(request, baseURL!, 'redirects', { from: '/accommodation', to: '/rooms', type: '301', enabled: true });
	await request.dispose();
});

test('the home page renders', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Slow mornings at 3,500 m');
	await expect(page.locator('main#main')).toBeVisible();
});

test('a room page enquiry is submitted and stored (JS)', async ({ page }) => {
	const name = uid('Guest');
	await page.goto('/rooms/orchard-room');
	await page.waitForLoadState('networkidle');
	const form = page.locator('#enquire form');
	await form.getByLabel('Name', { exact: true }).fill(name);
	await form.getByLabel('Email', { exact: true }).fill('guest@example.com');
	await form.getByLabel('Arrive', { exact: true }).fill('2026-07-01');
	await form.getByLabel('Leave', { exact: true }).fill('2026-07-05');
	await form.getByLabel(/Dolkar House may contact me/).check();
	await form.getByRole('button', { name: 'Send enquiry' }).click();
	await expect(page.locator('#enquire')).toContainText('Your message has been sent');

	// The submission is admin-only: it shows up in the admin list.
	const list = await page.request.get('/api/collections/submissions?limit=100');
	expect(list.ok()).toBe(true);
	const docs = ((await list.json()) as { docs: { name?: string; form?: string; data?: { room?: string } }[] }).docs;
	const mine = docs.find((d) => d.name === name);
	expect(mine?.form).toBe('booking');
	expect(mine?.data?.room).toBe('orchard-room');
});

test('the enquiry works without JavaScript (303 back with ?enquiry=sent)', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
	const page = await context.newPage();
	await page.goto('/rooms/orchard-room');
	const form = page.locator('#enquire form');
	await form.getByLabel('Name', { exact: true }).fill(uid('NoJs'));
	await form.getByLabel('Email', { exact: true }).fill('nojs@example.com');
	await form.getByLabel('Arrive', { exact: true }).fill('2026-08-01');
	await form.getByLabel('Leave', { exact: true }).fill('2026-08-03');
	await form.getByLabel(/Dolkar House may contact me/).check();
	await form.getByRole('button', { name: 'Send enquiry' }).click();
	await expect(page).toHaveURL(/enquiry=sent/);
	await expect(page.locator('#enquire')).toContainText('Your message has been sent');
	await context.close();
});

test('sitemap.xml lists the content, robots.txt points at it', async ({ request, baseURL }) => {
	const sitemap = await request.get('/sitemap.xml');
	expect(sitemap.ok()).toBe(true);
	expect(sitemap.headers()['content-type']).toContain('xml');
	const xml = await sitemap.text();
	expect(xml).toContain(`<loc>${baseURL}/</loc>`);
	expect(xml).toContain(`<loc>${baseURL}/rooms/orchard-room</loc>`);
	expect(xml).toContain(`<loc>${baseURL}/dining</loc>`);

	const robots = await request.get('/robots.txt');
	expect(robots.ok()).toBe(true);
	const txt = await robots.text();
	expect(txt).toContain('Disallow: /admin');
	expect(txt).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
});

test('a configured redirect answers 301', async ({ request }) => {
	const res = await request.get('/accommodation', { maxRedirects: 0 });
	expect(res.status()).toBe(301);
	expect(res.headers()['location']).toContain('/rooms');
});
