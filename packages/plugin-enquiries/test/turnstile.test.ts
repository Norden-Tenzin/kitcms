import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: undefined }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('no request event');
	},
}));
vi.mock('$app/env', () => ({ dev: false, building: false }));

import { __setDeps } from '../src/deps';
import { json, formPost, setup, validBooking, type Env } from './harness';

let env: Env;
let restore: (() => void) | undefined;
const calls: { url: string; body: string }[] = [];
let secret: string | undefined = 's3cret';
let verdict: unknown = { success: true };

beforeAll(async () => {
	env = await setup({ turnstile: { siteKey: '1x00000000000000000000AA' } });
	restore = __setDeps({
		getEnv: async (n) => (n === 'TURNSTILE_SECRET' ? secret : undefined),
		fetch: (async (url: string, init: RequestInit) => {
			calls.push({ url, body: String(init.body) });
			return verdict instanceof Response ? verdict : Response.json(verdict);
		}) as never,
	});
});
afterAll(async () => {
	restore?.();
	await env.dispose();
});
afterEach(() => {
	secret = 's3cret';
	verdict = { success: true };
	calls.length = 0;
});

const stored = async () =>
	(
		(await env.cmsFor(null).find('submissions' as never, { overrideAccess: true } as never)) as unknown as {
			docs: unknown[];
		}
	).docs.length;

describe('turnstile', () => {
	it('stores a submission with a valid token (JSON and form)', async () => {
		const a = await env.call(
			'POST',
			'submit/booking',
			json({ ...validBooking, turnstileToken: 'tok1' }, { 'cf-connecting-ip': '198.51.100.1' }),
		);
		expect(a.status).toBe(200);
		expect(calls[0]!.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		const sent = new URLSearchParams(calls[0]!.body);
		expect(sent.get('secret')).toBe('s3cret');
		expect(sent.get('response')).toBe('tok1');
		expect(sent.get('remoteip')).toBe('198.51.100.1');
		const b = await env.call(
			'POST',
			'submit/booking',
			formPost({ name: 'F', email: 'f@example.com', consent: 'on', 'cf-turnstile-response': 'tok2' }),
		);
		expect(b.status).toBe(200);
		expect(await stored()).toBe(2);
	});

	it('400 for a missing token without calling Cloudflare', async () => {
		const before = await stored();
		const res = await env.call('POST', 'submit/booking', json(validBooking));
		expect(res.status).toBe(400);
		expect(await stored()).toBe(before);
	});

	it('400 when Cloudflare rejects the token', async () => {
		verdict = { success: false, 'error-codes': ['invalid-input-response'] };
		const before = await stored();
		const res = await env.call('POST', 'submit/booking', json({ ...validBooking, turnstileToken: 'bad' }));
		expect(res.status).toBe(400);
		expect(await stored()).toBe(before);
	});

	it('fails closed: missing secret is 500, verification outage is 503', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		secret = undefined;
		const before = await stored();
		const a = await env.call('POST', 'submit/booking', json({ ...validBooking, turnstileToken: 'x' }));
		expect(a.status).toBe(500);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
		secret = 's3cret';
		verdict = new Response('boom', { status: 502 });
		const b = await env.call('POST', 'submit/booking', json({ ...validBooking, turnstileToken: 'x' }));
		expect(b.status).toBe(503);
		expect(await stored()).toBe(before);
	});

	it('exposes only the site key on the definition endpoint', async () => {
		const def = (await (await env.call('GET', 'forms/booking')).json()) as { turnstileSiteKey: string };
		expect(def.turnstileSiteKey).toBe('1x00000000000000000000AA');
	});
});
