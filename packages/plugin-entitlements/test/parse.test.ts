import { describe, expect, it, vi } from 'vitest';
import { createProvider } from '../src/plugin';
import { parseEntitlements } from '../src';

const good = {
	plan: 'starter',
	addons: ['booking', 'shop_2'],
	limits: { documents: { pages: 50 }, uploadBytes: 5_000_000 },
};
const closed = {
	plan: 'unknown',
	addons: [],
	limits: { documents: {}, uploadBytes: null },
	valid: false,
};

describe('parseEntitlements', () => {
	it('parses an object and a JSON string alike', () => {
		const expected = { ...good, valid: true };
		expect(parseEntitlements(good)).toEqual(expected);
		expect(parseEntitlements(JSON.stringify(good))).toEqual(expected);
	});
	it('limits are optional', () => {
		expect(parseEntitlements({ plan: 'free', addons: [] })).toEqual({
			plan: 'free',
			addons: [],
			limits: { documents: {}, uploadBytes: null },
			valid: true,
		});
	});
	it.each([
		['undefined', undefined],
		['null', null],
		['empty string', ''],
		['bad json', '{nope'],
		['array', []],
		['number', 3],
		['no plan', { addons: [] }],
		['empty plan', { plan: ' ', addons: [] }],
		['no addons', { plan: 'x' }],
		['addons not array', { plan: 'x', addons: 'booking' }],
		['addon not string', { plan: 'x', addons: [1] }],
		['addon uppercase', { plan: 'x', addons: ['Booking'] }],
		['addon leading digit', { plan: 'x', addons: ['1a'] }],
		['addon too long', { plan: 'x', addons: ['a'.repeat(65)] }],
		['one bad addon poisons all', { plan: 'x', addons: ['booking', 'BAD!'] }],
		['negative limit', { plan: 'x', addons: [], limits: { documents: { pages: -1 } } }],
		['fractional limit', { plan: 'x', addons: [], limits: { documents: { pages: 1.5 } } }],
		['string limit', { plan: 'x', addons: [], limits: { documents: { pages: '5' } } }],
		['negative uploadBytes', { plan: 'x', addons: [], limits: { uploadBytes: -5 } }],
		['limits not object', { plan: 'x', addons: [], limits: 5 }],
		['documents is array', { plan: 'x', addons: [], limits: { documents: [] } }],
	])('fails closed: %s', (_n, raw) => {
		expect(parseEntitlements(raw)).toEqual(closed);
	});
	it('de-duplicates add-ons', () => {
		expect(parseEntitlements({ plan: 'x', addons: ['a', 'a'] }).addons).toEqual(['a']);
	});
});

describe('provider.has', () => {
	it('is true only for listed add-ons', async () => {
		const p = createProvider({ read: () => JSON.stringify(good) });
		expect(await p.has('booking')).toBe(true);
		expect(await p.has('shop')).toBe(false);
	});
	it('is false when read() throws or rejects, never throws', async () => {
		expect(
			await createProvider({
				read: () => {
					throw new Error('x');
				},
			}).has('booking'),
		).toBe(false);
		expect(
			await createProvider({ read: () => Promise.reject(new Error('x')) }).has('booking'),
		).toBe(false);
	});
	it('is false for a missing or invalid value', async () => {
		expect(await createProvider({ read: () => undefined }).has('booking')).toBe(false);
		expect(await createProvider({ read: () => '{bad' }).has('booking')).toBe(false);
	});
	it('re-parses only when the raw value changes', async () => {
		let raw: unknown = JSON.stringify(good);
		const read = vi.fn(() => raw);
		const p = createProvider({ read });
		const a = await p.get();
		expect(await p.get()).toBe(a); // same parsed object: cached
		raw = JSON.stringify({ plan: 'pro', addons: ['shop'] });
		expect(await p.has('shop')).toBe(true);
		expect(await p.has('booking')).toBe(false);
		expect((await p.get()).plan).toBe('pro');
	});
});
