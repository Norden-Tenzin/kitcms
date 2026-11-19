// Decision 41: `notify` and `turnstile.siteKey` may be functions resolved per request.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: undefined }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('no request event');
	},
}));
vi.mock('$app/env', () => ({ dev: false, building: false }));

import type { RuntimeContext } from '@kitcms/core';
import { booking, json, setup, validBooking, type Env } from './harness';

let env: Env | undefined;
afterEach(async () => {
	await env?.dispose();
	env = undefined;
});

const latest = async (e: Env) =>
	(
		(await e.cmsFor(null).find('submissions' as never, { overrideAccess: true, limit: 1 } as never)) as unknown as {
			docs: Record<string, unknown>[];
		}
	).docs[0]!;

describe('notify as a function', () => {
	it('is resolved per submission with the runtime context; invalid and duplicate addresses are skipped', async () => {
		const seen: unknown[] = [];
		env = await setup({
			forms: {
				booking: {
					...booking,
					notify: async ({ env: workerEnv, cms }: RuntimeContext) => {
						seen.push(Boolean(workerEnv.DB), typeof cms.find);
						return ['owner@hotel.test', 'not an email', 'owner@hotel.test'];
					},
				} as never,
			},
		});
		const res = await env.call('POST', 'submit/booking', json(validBooking));
		expect(res.status).toBe(200);
		expect(seen).toEqual([true, 'function']);
		expect(env.sent).toHaveLength(1);
		expect(env.sent[0]!.to).toEqual(['owner@hotel.test']);
		expect((await latest(env)).notified).toBe(true);
	});

	it('stores without sending when it resolves to no valid address', async () => {
		env = await setup({ forms: { booking: { ...booking, notify: () => ['', 'nope'] } as never } });
		const res = await env.call('POST', 'submit/booking', json(validBooking));
		expect(res.status).toBe(200);
		expect(env.sent).toHaveLength(0);
		expect((await latest(env)).notified).toBe(false);
	});

	it('a throwing function never fails the submission', async () => {
		env = await setup({
			forms: {
				booking: {
					...booking,
					notify: () => {
						throw new Error('global missing');
					},
				} as never,
			},
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await env.call('POST', 'submit/booking', json(validBooking));
		expect(res.status).toBe(200);
		expect(env.sent).toHaveLength(0);
		expect((await latest(env)).notified).toBe(false);
	});
});

describe('turnstile.siteKey as a function', () => {
	it('is resolved for the definition endpoint; an empty value is null', async () => {
		env = await setup({ turnstile: { siteKey: ({ env: e }) => (e.DB ? 'key-from-env' : undefined) } });
		const def = (await (await env.call('GET', 'forms/booking')).json()) as { turnstileSiteKey: string | null };
		expect(def.turnstileSiteKey).toBe('key-from-env');
		await env.dispose();
		env = await setup({ turnstile: { siteKey: () => '' } });
		const empty = (await (await env.call('GET', 'forms/booking')).json()) as { turnstileSiteKey: string | null };
		expect(empty.turnstileSiteKey).toBeNull();
	});
});
