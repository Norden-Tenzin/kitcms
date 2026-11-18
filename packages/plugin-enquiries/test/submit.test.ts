import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: undefined }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('no request event');
	},
}));
vi.mock('$app/env', () => ({ dev: false, building: false }));

import { ORIGIN, admin, editor, formPost, json, setup, validBooking, type Env } from './harness';

let env: Env;
beforeAll(async () => {
	env = await setup();
});
afterAll(async () => {
	await env.dispose();
});

const all = async () =>
	(await env.cmsFor(null).find('submissions' as never, { overrideAccess: true, limit: 100 } as never)) as unknown as {
		docs: Record<string, unknown>[];
	};
const count = async () => (await all()).docs.length;

describe('submit', () => {
	it('stores a JSON submission, notifies, and marks it notified', async () => {
		const before = await count();
		env.sent.length = 0;
		const res = await env.call('POST', 'submit/booking', json(validBooking, { referer: `${ORIGIN}/contact?x=1` }));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true });
		const docs = (await all()).docs;
		expect(docs.length).toBe(before + 1);
		const doc = docs.find((d) => d.email === 'tashi@example.com')!;
		expect(doc).toMatchObject({
			form: 'booking',
			name: 'Tashi <b>Dorje</b>',
			status: 'new',
			notified: true,
			page: '/contact',
		});
		expect((doc.data as Record<string, unknown>).guests).toBe(2);
		expect(env.sent).toHaveLength(1);
		const mail = env.sent[0]!;
		expect(mail.to).toEqual(['front-desk@hotel.test']);
		expect(mail.replyTo).toBe('tashi@example.com');
		expect(mail.subject).toBe('Booking from Tashi <b>Dorje</b>');
		expect(mail.subject).not.toMatch(/[\r\n]/);
		expect(mail.text).toContain('Name: Tashi <b>Dorje</b>');
		expect(mail.html).toContain('Tashi &lt;b&gt;Dorje&lt;/b&gt;');
		expect(mail.html).not.toContain('<b>Dorje</b>');
	});

	it('strips CR/LF from substituted subject values', async () => {
		env.sent.length = 0;
		await env.call('POST', 'submit/booking', json({ ...validBooking, name: 'A\r\nBcc: x@evil.test' }));
		expect(env.sent[0]!.subject).toBe('Booking from A Bcc: x@evil.test');
	});

	it('accepts form-encoded posts (checkbox "on")', async () => {
		const res = await env.call(
			'POST',
			'submit/booking',
			formPost({ name: 'Form User', email: 'f@example.com', consent: 'on', guests: '3' }),
		);
		expect(res.status).toBe(200);
		const doc = (await all()).docs.find((d) => d.email === 'f@example.com')!;
		expect((doc.data as Record<string, unknown>).guests).toBe(3);
		expect((doc.data as Record<string, unknown>).consent).toBe(true);
	});

	it('drops unknown keys and reserved fields', async () => {
		await env.call(
			'POST',
			'submit/booking',
			json({ ...validBooking, email: 'drop@example.com', evil: 'x', status: 'handled', notified: true }),
		);
		const doc = (await all()).docs.find((d) => d.email === 'drop@example.com')!;
		expect(Object.keys(doc.data as object)).not.toContain('evil');
		expect(doc.status).toBe('new');
	});

	it('rejects invalid fields with 400 and errors', async () => {
		const before = await count();
		const res = await env.call(
			'POST',
			'submit/booking',
			json({ name: '', email: 'nope', guests: 99, arrival: '2027-02-30', room: 'penthouse', consent: false }),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string; errors: { path: string; message: string }[] };
		expect(body.error).toBeTruthy();
		expect(body.errors.map((e) => e.path).sort()).toEqual(['arrival', 'consent', 'email', 'guests', 'name', 'room']);
		expect(await count()).toBe(before);
	});

	it('rejects too-long text, non-integer numbers, wrong types and bad JSON', async () => {
		const long = await env.call('POST', 'submit/booking', json({ ...validBooking, name: 'x'.repeat(51) }));
		expect(long.status).toBe(400);
		const frac = await env.call('POST', 'submit/booking', json({ ...validBooking, guests: 1.5 }));
		expect(frac.status).toBe(400);
		const typed = await env.call('POST', 'submit/booking', json({ ...validBooking, name: { a: 1 } }));
		expect(typed.status).toBe(400);
		const bad = await env.call('POST', 'submit/booking', {
			body: '{nope',
			headers: { 'content-type': 'application/json' },
		});
		expect(bad.status).toBe(400);
		const arr = await env.call('POST', 'submit/booking', json([1]));
		expect(arr.status).toBe(400);
		const ct = await env.call('POST', 'submit/booking', { body: 'x', headers: { 'content-type': 'text/plain' } });
		expect(ct.status).toBe(415);
	});

	it('rejects file parts', async () => {
		const fd = new FormData();
		fd.set('name', 'x');
		fd.set('file', new File(['hi'], 'a.txt'));
		const req = new Request('https://x.test', { method: 'POST', body: fd });
		const body = new Uint8Array(await req.arrayBuffer());
		const res = await env.call('POST', 'submit/booking', {
			body: new TextDecoder().decode(body),
			headers: { 'content-type': req.headers.get('content-type')! },
		});
		expect(res.status).toBe(400);
	});

	it('404 for an unknown form, 404/405 for unknown routes', async () => {
		expect((await env.call('POST', 'submit/nope', json({}))).status).toBe(404);
		expect((await env.call('GET', 'submit/booking')).status).toBe(405);
	});

	it('413 for an oversized body', async () => {
		const res = await env.call('POST', 'submit/booking', json({ ...validBooking, message: 'a'.repeat(20 * 1024) }));
		expect(res.status).toBe(413);
	});

	it('403 for a foreign or missing origin', async () => {
		const before = await count();
		expect((await env.call('POST', 'submit/booking', { ...json(validBooking), origin: 'https://evil.test' })).status).toBe(403);
		expect((await env.call('POST', 'submit/booking', { ...json(validBooking), origin: null })).status).toBe(403);
		expect(await count()).toBe(before);
	});

	it('honeypot: success-like response, nothing stored or sent', async () => {
		const before = await count();
		env.sent.length = 0;
		const res = await env.call('POST', 'submit/booking', json({ ...validBooking, _hp: 'http://spam.test' }));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true });
		expect(await count()).toBe(before);
		expect(env.sent).toHaveLength(0);
	});

	it('stores the submission and leaves notified false when the email fails', async () => {
		env.email.failWith = new Error('smtp down');
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const res = await env.call('POST', 'submit/booking', json({ ...validBooking, email: 'fail@example.com' }));
			expect(res.status).toBe(200);
			const doc = (await all()).docs.find((d) => d.email === 'fail@example.com')!;
			expect(doc.notified).toBe(false);
			expect(spy).toHaveBeenCalled();
		} finally {
			env.email.failWith = null;
			spy.mockRestore();
		}
	});

	it('stores without email when email is not configured', async () => {
		env.email.enabled = false;
		env.sent.length = 0;
		const res = await env.call('POST', 'submit/booking', json({ ...validBooking, email: 'noemail@example.com' }));
		env.email.enabled = true;
		expect(res.status).toBe(200);
		expect(env.sent).toHaveLength(0);
		expect((await all()).docs.find((d) => d.email === 'noemail@example.com')!.notified).toBe(false);
	});
});

describe('no-JS form posts', () => {
	const html = { accept: 'text/html,application/xhtml+xml' };

	it('303 to the submitting page with ?enquiry=sent', async () => {
		const res = await env.call(
			'POST',
			'submit/booking',
			formPost({ ...strings(validBooking), email: 'nojs@example.com', _page: '/contact?lang=en' }, html),
		);
		expect(res.status).toBe(303);
		expect(res.headers.get('location')).toBe('/contact?lang=en&enquiry=sent');
	});

	it('303 with enquiry=error and the failing fields on validation errors', async () => {
		const res = await env.call('POST', 'submit/booking', formPost({ _page: '/contact', name: '' }, html));
		expect(res.status).toBe(303);
		const loc = new URL(res.headers.get('location')!, 'https://site.test');
		expect(loc.pathname).toBe('/contact');
		expect(loc.searchParams.get('enquiry')).toBe('error');
		expect(loc.searchParams.get('fields')).toContain('name');
	});

	it.each(['//evil.test', 'https://evil.test', '/\\evil.test', '\\\\evil.test', 'javascript:alert(1)', '/\t/evil.test', '///evil.test'])(
		'never redirects to %s',
		async (page) => {
			const res = await env.call('POST', 'submit/booking', formPost({ ...strings(validBooking), _page: page }, html));
			expect(res.status).toBe(303);
			const loc = res.headers.get('location')!;
			expect(loc.startsWith('/')).toBe(true);
			expect(loc.startsWith('//')).toBe(false);
			expect(loc).not.toContain('\\');
			expect(new URL(loc, 'https://site.test').origin).toBe('https://site.test');
			expect(loc).toBe('/?enquiry=sent');
		},
	);

	it('uses a same-origin Referer, ignores a foreign one', async () => {
		const ok = await env.call('POST', 'submit/booking', formPost(strings(validBooking), { ...html, referer: `${ORIGIN}/stay` }));
		expect(ok.headers.get('location')).toBe('/stay?enquiry=sent');
		const foreign = await env.call(
			'POST',
			'submit/booking',
			formPost(strings(validBooking), { ...html, referer: 'https://evil.test/x' }),
		);
		expect(foreign.headers.get('location')).toBe('/?enquiry=sent');
	});

	it('honeypot also redirects like a success', async () => {
		const before = await count();
		const res = await env.call('POST', 'submit/booking', formPost({ ...strings(validBooking), _hp: 'x', _page: '/c' }, html));
		expect(res.headers.get('location')).toBe('/c?enquiry=sent');
		expect(await count()).toBe(before);
	});
});

describe('definition endpoint', () => {
	it('returns the public form definition without secrets', async () => {
		const res = await env.call('GET', 'forms/booking');
		expect(res.status).toBe(200);
		const def = (await res.json()) as {
			label: string;
			turnstileSiteKey: string | null;
			fields: { name: string; type: string; required: boolean; options?: unknown }[];
		};
		expect(def.label).toBe('Booking');
		expect(def.turnstileSiteKey).toBeNull();
		expect(def.fields.find((x) => x.name === 'room')!.options).toEqual([
			{ label: 'standard', value: 'standard' },
			{ label: 'Suite', value: 'suite' },
		]);
		expect(JSON.stringify(def)).not.toContain('front-desk');
		expect((await env.call('GET', 'forms/nope')).status).toBe(404);
	});
});

describe('access', () => {
	it('anonymous callers cannot read or create submissions', async () => {
		const anon = env.cmsFor(null);
		await expect(anon.find('submissions' as never, {} as never)).rejects.toMatchObject({ status: 403 });
		await expect(
			anon.create('submissions' as never, { form: 'booking', data: {} } as never),
		).rejects.toMatchObject({ status: 403 });
		await expect(anon.create('submissions' as never, { form: 'booking' } as never, {} as never)).rejects.toBeTruthy();
	});

	it('non-admin signed-in users cannot read or write; nobody but the endpoint can create', async () => {
		const ed = env.cmsFor(editor);
		await expect(ed.find('submissions' as never, {} as never)).rejects.toMatchObject({ status: 403 });
		const adm = env.cmsFor(admin);
		await expect(adm.create('submissions' as never, { form: 'booking', data: {} } as never)).rejects.toMatchObject({
			status: 403,
		});
	});

	it('admins can read and set the status, but not edit the data', async () => {
		await env.call('POST', 'submit/booking', json({ ...validBooking, email: 'adm@example.com' }));
		const adm = env.cmsFor(admin);
		const found = (await adm.find('submissions' as never, { where: { email: { equals: 'adm@example.com' } } } as never)) as unknown as {
			docs: { id: string; data: unknown }[];
		};
		const doc = found.docs[0]!;
		expect(doc).toBeTruthy();
		const updated = (await adm.update(
			'submissions' as never,
			doc.id,
			{ status: 'handled', email: 'changed@example.com', data: { tampered: true }, name: 'X', notified: false } as never,
		)) as unknown as Record<string, unknown>;
		expect(updated.status).toBe('handled');
		expect(updated.email).toBe('adm@example.com');
		expect(updated.name).toBe('Tashi <b>Dorje</b>');
		expect(updated.data).not.toEqual({ tampered: true });
		expect(updated.notified).toBe(true);
	});
});

describe('rate limit', () => {
	it('429 after the per-IP maximum', async () => {
		const ip = { 'cf-connecting-ip': '203.0.113.9' };
		for (let i = 0; i < 5; i++) {
			const r = await env.call('POST', 'submit/booking', json({}, ip));
			expect(r.status).toBe(400); // counted even when invalid
		}
		const limited = await env.call('POST', 'submit/booking', json(validBooking, ip));
		expect(limited.status).toBe(429);
		expect(limited.headers.get('retry-after')).toBeTruthy();
	});
});

function strings(o: Record<string, unknown>): Record<string, string> {
	return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === true ? 'on' : String(v)]));
}
