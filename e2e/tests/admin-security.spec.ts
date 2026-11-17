import { expect, test } from '@playwright/test';
import { ADMIN } from '../constants';
import { anonymous } from './helpers';

// Smoke checks for the CSRF defence (Origin) on admin actions and REST writes. The signed-in
// session (cookies) is sent on every request, so only the Origin decides the outcome.
const FOREIGN = 'https://evil.example';

test('a cross-origin POST to an admin action is blocked', async ({ request, baseURL }) => {
	for (const action of ['logout', 'setTenant', 'login']) {
		const res = await request.post(`/admin?/${action}`, {
			headers: { origin: FOREIGN, 'x-sveltekit-action': 'true' },
			form: { email: ADMIN.email, password: ADMIN.password, tenant: '' },
			failOnStatusCode: false,
		});
		expect(res.status(), action).toBe(403);
	}
	// A same-origin tenant switch is accepted (the control).
	const ok = await request.post('/admin?/setTenant', {
		headers: { origin: baseURL!, 'x-sveltekit-action': 'true' },
		form: { tenant: '' },
	});
	expect(ok.ok()).toBe(true);
});

test('an admin action with no Origin header is blocked', async ({ request }) => {
	const res = await request.post('/admin?/setTenant', {
		headers: { 'x-sveltekit-action': 'true' },
		form: { tenant: '' },
		failOnStatusCode: false,
	});
	expect(res.status()).toBe(403);
});

test('the session survived the blocked requests', async ({ page }) => {
	await page.goto('/admin');
	await expect(page.getByTestId('whoami')).toHaveText(ADMIN.email);
});

test('a REST write without Origin, or with a foreign one, is blocked and writes nothing', async ({ request, baseURL }) => {
	const title = `csrf-${Date.now().toString(36)}`;
	const noOrigin = await request.post('/api/collections/pages', { data: { title }, failOnStatusCode: false });
	expect(noOrigin.status()).toBe(403);
	const foreign = await request.post('/api/collections/pages', {
		data: { title },
		headers: { origin: FOREIGN },
		failOnStatusCode: false,
	});
	expect(foreign.status()).toBe(403);

	// The control: same Origin and a session is accepted.
	const ok = await request.post('/api/collections/pages', { data: { title }, headers: { origin: baseURL! } });
	expect(ok.status()).toBe(201);
	const { doc } = (await ok.json()) as { doc?: { id: string }; id?: string };
	const id = doc?.id ?? ((await ok.json()) as { id: string }).id;

	const list = await request.get(`/api/collections/pages?limit=100&draft=true`);
	const titles = ((await list.json()) as { docs: { title: string }[] }).docs.filter((d) => d.title === title);
	expect(titles).toHaveLength(1);

	const del = await request.delete(`/api/collections/pages/${id}`, { headers: { origin: FOREIGN }, failOnStatusCode: false });
	expect(del.status()).toBe(403);
	const delOk = await request.delete(`/api/collections/pages/${id}`, { headers: { origin: baseURL! } });
	expect(delOk.ok()).toBe(true);
});

test('anonymous REST writes are refused even with the right Origin', async ({ playwright, baseURL }) => {
	const anon = await anonymous(playwright, baseURL!);
	const res = await anon.post('/api/collections/pages', {
		data: { title: 'anon' },
		headers: { origin: baseURL! },
		failOnStatusCode: false,
	});
	expect([401, 403]).toContain(res.status());
	await anon.dispose();
});

test('the upload endpoint rejects a cross-origin POST', async ({ request }) => {
	const res = await request.post('/api/upload/media', {
		headers: { origin: FOREIGN },
		multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
		failOnStatusCode: false,
	});
	expect(res.status()).toBe(403);
});
