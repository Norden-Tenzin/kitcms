// SPIKE: dependency-free ULID (Crockford base32, 48-bit ms time + 80 bits randomness).
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(now = Date.now()): string {
	let time = '';
	for (let i = 9, t = now; i >= 0; i--, t = Math.floor(t / 32)) time = B32[t % 32] + time;
	const rand = crypto.getRandomValues(new Uint8Array(16));
	let r = '';
	for (const byte of rand) r += B32[byte % 32];
	return time + r;
}
