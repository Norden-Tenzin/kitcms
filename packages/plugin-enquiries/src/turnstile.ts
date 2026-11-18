// Cloudflare Turnstile server-side verification. Fails closed.
import { deps } from './deps';

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = 'ok' | 'invalid' | 'no-secret' | 'unavailable';

export async function verifyTurnstile(
	secretName: string,
	token: string | null,
	ip: string | null,
): Promise<TurnstileResult> {
	let secret: string | undefined;
	try {
		secret = await deps.getEnv(secretName);
	} catch {
		secret = undefined;
	}
	if (!secret) return 'no-secret';
	if (!token || token.length > 4096) return 'invalid';
	const body = new URLSearchParams({ secret, response: token });
	if (ip) body.set('remoteip', ip);
	try {
		const res = await deps.fetch(SITEVERIFY_URL, { method: 'POST', body });
		if (!res.ok) return 'unavailable';
		const json = (await res.json()) as { success?: unknown };
		return json.success === true ? 'ok' : 'invalid';
	} catch {
		return 'unavailable';
	}
}
