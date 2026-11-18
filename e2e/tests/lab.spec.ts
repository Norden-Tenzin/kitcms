// The Lab pages: row-level access (notes) and field access (kitchen-sink `internalNote`). Content is
// created through the REST API as the admin; an anonymous browser context must only see public notes.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { AUTH_FILE } from '../constants';
import { uid } from './helpers';

const PUBLIC_NOTE = uid('Public note');
const TEAM_NOTE = uid('Team note');
const SINK = uid('Sink sample');
const SINK_SLUG = SINK.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function create(request: APIRequestContext, baseURL: string, collection: string, data: Record<string, unknown>) {
	const res = await request.post(`/api/collections/${collection}`, {
		data: { _status: 'published', ...data },
		headers: { origin: baseURL },
	});
	expect(res.status(), await res.text()).toBe(201);
}

test.beforeAll(async ({ playwright, baseURL }) => {
	const request = await playwright.request.newContext({ baseURL, storageState: AUTH_FILE });
	await create(request, baseURL!, 'notes', { title: PUBLIC_NOTE, visibility: 'public' });
	await create(request, baseURL!, 'notes', { title: TEAM_NOTE, visibility: 'team' });
	await create(request, baseURL!, 'kitchen-sink', { title: SINK, internalNote: 'staff only', summary: 'Everything.' });
	await request.dispose();
});

test('an anonymous visitor sees only public notes', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
	const page = await context.newPage();
	await page.goto('/lab/access');
	await expect(page.getByText(PUBLIC_NOTE)).toBeVisible();
	await expect(page.getByText(TEAM_NOTE)).toHaveCount(0);
	await expect(page.getByTestId('internal-note')).toContainText('hidden from visitors');
	await context.close();
});

test('a signed-in user sees both notes (REST, session cookie)', async ({ page }) => {
	await page.goto('/lab/access');
	await expect(page.getByTestId('my-notes')).toContainText(PUBLIC_NOTE);
	await expect(page.getByTestId('my-notes')).toContainText(TEAM_NOTE);
	// The server-rendered part always reads as a visitor.
	await expect(page.getByTestId('notes')).not.toContainText(TEAM_NOTE);
});

test('the field sample hides internalNote from visitors', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
	const page = await context.newPage();
	await page.goto(`/lab/fields/${SINK_SLUG}`);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(SINK);
	await expect(page.getByText('hidden from visitors')).toBeVisible();
	await expect(page.getByText('staff only')).toHaveCount(0);
	await context.close();
});

test('a signed-in user reads internalNote over REST', async ({ request }) => {
	const res = await request.get(`/api/collections/kitchen-sink?where[slug][equals]=${SINK_SLUG}`);
	expect(res.ok()).toBe(true);
	const docs = ((await res.json()) as { docs: { internalNote?: string }[] }).docs;
	expect(docs[0]?.internalNote).toBe('staff only');
});
