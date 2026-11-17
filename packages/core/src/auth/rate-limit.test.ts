import { describe, expect, it } from 'vitest';
import { decide, normalizeEmail, signInKeys } from './rate-limit';

const rule = { max: 5, window: 60 };

describe('decide', () => {
	it('allows up to max attempts in a window, then blocks with a retry hint', () => {
		const start = 1_000_000;
		for (let count = 1; count <= 5; count++) {
			expect(decide({ count, lastRequest: start }, rule, start + 1000).allowed).toBe(true);
		}
		const blocked = decide({ count: 6, lastRequest: start }, rule, start + 10_000);
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfter).toBe(50);
	});

	it('retryAfter is at least 1 second', () => {
		expect(decide({ count: 9, lastRequest: 0 }, rule, 60_000).retryAfter).toBe(1);
	});
});

describe('signInKeys', () => {
	it('keys by normalized email and by ip, namespaced', () => {
		expect(signInKeys({ ip: '1.2.3.4', email: ' A@B.co ' })).toEqual([
			'kitcms:signin:email:a@b.co',
			'kitcms:signin:ip:1.2.3.4',
		]);
	});
	it('skips the ip bucket when unknown', () => {
		expect(signInKeys({ ip: null, email: 'a@b.co' })).toEqual(['kitcms:signin:email:a@b.co']);
	});
});

describe('normalizeEmail', () => {
	it('trims and lowercases', () => expect(normalizeEmail('  X@Y.Co ')).toBe('x@y.co'));
});
