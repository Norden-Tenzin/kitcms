// The public Halden Studio site on the built playground: home, the project brief form (JS and no-JS),
// a project page, the SEO plugin's sitemap, robots.txt and redirects, and the offers add-on. The e2e
// database is not seeded, so the content is created through the REST API as the signed-in admin.
//
// Turnstile: the build for this run sets `VITE_TURNSTILE=off` (see scripts/prepare.mjs), which leaves
// Turnstile out of the enquiry forms, so the test needs no network access to Cloudflare. Never set it in
// a real deployment.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { AUTH_FILE } from '../constants';
import { uid } from './helpers';

const PROJECT = uid('Harbour Lines');
const PROJECT_SLUG = PROJECT.toLowerCase().replace(/[^a-z0-9]+/g, '-');

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
		sections: [{ blockType: 'hero', heading: 'Design that earns its keep', ctaLabel: 'Start a project', ctaHref: '/contact' }],
	});
	await create(request, baseURL!, 'projects', { title: PROJECT, summary: 'A new identity for a ferry company.', client: 'Harbour Co', year: 2025 });
	await create(request, baseURL!, 'redirects', { from: '/portfolio', to: '/work', type: '301', enabled: true });
	await request.dispose();
});

test('the home page renders', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Design that earns its keep');
	await expect(page.locator('main#main')).toBeVisible();
});

async function fillBrief(page: Page, name: string, email: string) {
	const form = page.locator('#brief form');
	await form.getByLabel('Name', { exact: true }).fill(name);
	await form.getByLabel('Email', { exact: true }).fill(email);
	await form.getByLabel('Company', { exact: true }).fill('Example Ltd');
	await form.getByLabel('Service', { exact: true }).selectOption({ index: 1 });
	await form.getByLabel('Budget', { exact: true }).selectOption({ index: 1 });
	await form.getByLabel('Timeline', { exact: true }).selectOption({ index: 1 });
	await form.getByLabel('Message', { exact: true }).fill('We need a new site and a calmer brand.');
	await form.getByLabel('Halden Studio may contact me about this enquiry.').check();
	await form.getByRole('button', { name: 'Send brief' }).click();
}

test('the brief form is submitted and stored (JS)', async ({ page }) => {
	const name = uid('Client');
	await page.goto('/contact');
	await page.waitForLoadState('networkidle');
	await fillBrief(page, name, 'client@example.com');
	await expect(page.locator('#brief')).toContainText('Thanks, your message has been sent');

	// The submission is admin-only: it shows up in the admin list.
	const list = await page.request.get('/api/collections/submissions?limit=100');
	expect(list.ok()).toBe(true);
	const docs = ((await list.json()) as { docs: { name?: string; form?: string }[] }).docs;
	expect(docs.find((d) => d.name === name)?.form).toBe('brief');
});

test('the brief form works without JavaScript (303 back with ?enquiry=sent)', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
	const page = await context.newPage();
	await page.goto('/contact');
	await fillBrief(page, uid('NoJs'), 'nojs@example.com');
	await expect(page).toHaveURL(/enquiry=sent/);
	await expect(page.locator('#brief')).toContainText('Thanks, your message has been sent');
	await context.close();
});

test('a project page renders', async ({ page }) => {
	await page.goto(`/work/${PROJECT_SLUG}`);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(PROJECT);
});

test('sitemap.xml lists the content, robots.txt points at it', async ({ request, baseURL }) => {
	const sitemap = await request.get('/sitemap.xml');
	expect(sitemap.ok()).toBe(true);
	expect(sitemap.headers()['content-type']).toContain('xml');
	const xml = await sitemap.text();
	expect(xml).toContain(`<loc>${baseURL}/</loc>`);
	expect(xml).toContain(`<loc>${baseURL}/work/${PROJECT_SLUG}</loc>`);
	expect(xml).toContain(`<loc>${baseURL}/services</loc>`);

	const robots = await request.get('/robots.txt');
	expect(robots.ok()).toBe(true);
	const txt = await robots.text();
	expect(txt).toContain('Disallow: /admin');
	expect(txt).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
});

test('a configured redirect answers 301', async ({ request }) => {
	const res = await request.get('/portfolio', { maxRedirects: 0 });
	expect(res.status()).toBe(301);
	expect(res.headers()['location']).toContain('/work');
});

test('the offers add-on is on: the admin can read the collection', async ({ request }) => {
	const res = await request.get('/api/collections/offers');
	expect(res.status()).toBe(200);
});
