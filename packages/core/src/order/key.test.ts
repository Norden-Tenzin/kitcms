import { describe, expect, it } from 'vitest';
import { isOrderKey, keyBetween } from './key';

/** SQLite BINARY collation = bytewise; for ASCII that's JS `<`. */
const sorted = (keys: string[]) => [...keys].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));

describe('keyBetween', () => {
	it('first key, append, prepend', () => {
		expect(keyBetween(null, null)).toBe('a0');
		expect(keyBetween('a0', null)).toBe('a1');
		expect(keyBetween(null, 'a0')).toBe('Zz');
		expect(keyBetween('a0', 'a1')).toBe('a0V');
	});

	it('appending 1000 times keeps keys short and increasing', () => {
		let k: string | null = null;
		const keys: string[] = [];
		for (let i = 0; i < 1000; i++) {
			k = keyBetween(k, null);
			keys.push(k);
		}
		expect(sorted(keys)).toEqual(keys);
		expect(Math.max(...keys.map((x) => x.length))).toBeLessThanOrEqual(4);
	});

	it('random inserts between neighbours keep a strict total order', () => {
		let seed = 42;
		const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
		const list: string[] = [keyBetween(null, null)];
		for (let i = 0; i < 2000; i++) {
			const at = Math.floor(rand() * (list.length + 1));
			const key = keyBetween(list[at - 1] ?? null, list[at] ?? null);
			expect(isOrderKey(key)).toBe(true);
			list.splice(at, 0, key);
		}
		expect(sorted(list)).toEqual(list);
		expect(new Set(list).size).toBe(list.length);
	});

	it('repeatedly inserting at the same spot grows slowly', () => {
		let a = 'a0';
		const b = 'a1';
		for (let i = 0; i < 200; i++) a = keyBetween(a, b);
		expect(a.length).toBeLessThan(60);
	});

	it('rejects bad input', () => {
		expect(() => keyBetween('a1', 'a0')).toThrow();
		expect(() => keyBetween('a1', 'a1')).toThrow();
		expect(() => keyBetween('a00', null)).toThrow();
		expect(() => keyBetween('!', null)).toThrow();
		expect(() => keyBetween('', null)).toThrow();
		expect(isOrderKey('a0')).toBe(true);
		expect(isOrderKey('a0V')).toBe(true);
		expect(isOrderKey('a')).toBe(false);
		expect(isOrderKey('a0 ')).toBe(false);
		expect(isOrderKey(null)).toBe(false);
	});
});
