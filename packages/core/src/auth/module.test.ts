// The Better Auth HTTP allowlist (security: one pipeline for user writes).
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ building: false, dev: false }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
vi.mock('$app/server', () => ({ getRequestEvent: () => undefined }));
const handler = vi.fn(async () => new Response('better-auth'));
vi.mock('better-auth/svelte-kit', () => ({ svelteKitHandler: handler, sveltekitCookies: () => ({}) }));
vi.mock('./better-auth', () => ({ getAuth: () => ({}) }));

const { handleAuthRoute, PUBLIC_AUTH_PATHS } = await import('./module');

const call = (path: string) =>
	handleAuthRoute({ url: new URL(`http://x${path}`) } as never, () => new Response('next'), {} as never);

describe('handleAuthRoute allowlist', () => {
	it('serves sign-in, sign-out and session endpoints', async () => {
		for (const p of PUBLIC_AUTH_PATHS) {
			handler.mockClear();
			await call(`/api/auth${p}`);
			expect(handler).toHaveBeenCalledOnce();
		}
	});
	it('404s every endpoint that writes users or accounts', async () => {
		for (const p of [
			'/update-user',
			'/change-email',
			'/change-password',
			'/delete-user',
			'/sign-up/email',
			'/reset-password',
			'/request-password-reset',
			'/link-social',
			'/sign-in/social',
			'/verify-password',
			'/some-future-endpoint',
			'',
		]) {
			handler.mockClear();
			const res = await call(`/api/auth${p}`);
			expect(res.status, p).toBe(404);
			expect(handler).not.toHaveBeenCalled();
		}
	});
});
