import { describe, expect, it } from 'vitest';
import { toAuthSession, toKitcmsUser } from './session';

describe('toKitcmsUser', () => {
	it('maps only the public fields', () => {
		const user = toKitcmsUser(
			{ id: 'u1', email: 'a@b.co', name: 'A', role: 'admin', password: 'x', emailVerified: true },
			'users',
		);
		expect(user).toEqual({ id: 'u1', email: 'a@b.co', name: 'A', role: 'admin', collection: 'users' });
	});

	it('a missing or non-string role becomes empty (never an accidental role)', () => {
		expect(toKitcmsUser({ id: 'u', email: 'a@b.co', name: 'A' }, 'users').role).toBe('');
		expect(toKitcmsUser({ id: 'u', email: 'a@b.co', name: 'A', role: 1 }, 'users').role).toBe('');
	});
});

describe('toAuthSession', () => {
	it('never carries the token', () => {
		const exp = new Date('2030-01-01T00:00:00Z');
		const s = toAuthSession({ id: 's1', token: 'secret', expiresAt: exp, ipAddress: '1.1.1.1' });
		expect(s).toEqual({ id: 's1', expiresAt: exp });
		expect('token' in s).toBe(false);
	});

	it('coerces stored timestamps to Date', () => {
		expect(toAuthSession({ id: 's', expiresAt: 1_900_000_000_000 }).expiresAt.getTime()).toBe(1_900_000_000_000);
	});
});
