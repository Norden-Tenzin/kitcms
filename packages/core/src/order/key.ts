// Fractional-index keys for orderable collections (plan §13.2). Pure, Workers-safe.
// Adapted from rocicorp/fractional-indexing (CC0, by David Greenspan / Rocicorp).
//
// A key is an "integer part" (a head letter giving its length, then base-62 digits) plus an
// optional fraction (base-62 digits, no trailing '0'). Keys compare correctly as plain strings,
// byte by byte, so SQLite's default BINARY collation sorts `_order` correctly. Appending at the
// end only increments the integer part, so keys stay short (1000 appends → 3–4 chars).

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0]!;
const SMALLEST_INTEGER = 'A' + ZERO.repeat(26);

function midpoint(a: string, b: string | null): string {
	if (b !== null && a >= b) throw new Error(`kitcms order: ${a} >= ${b}`);
	if (a.slice(-1) === ZERO || (b && b.slice(-1) === ZERO)) throw new Error('kitcms order: trailing zero');
	if (b) {
		let n = 0;
		while ((a[n] ?? ZERO) === b[n]) n++;
		if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
	}
	const digitA = a ? DIGITS.indexOf(a[0]!) : 0;
	const digitB = b !== null ? DIGITS.indexOf(b[0]!) : DIGITS.length;
	if (digitB - digitA > 1) return DIGITS[Math.round(0.5 * (digitA + digitB))]!;
	if (b && b.length > 1) return b.slice(0, 1);
	return DIGITS[digitA]! + midpoint(a.slice(1), null);
}

function integerLength(head: string): number {
	if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 97 + 2;
	if (head >= 'A' && head <= 'Z') return 90 - head.charCodeAt(0) + 2;
	throw new Error(`kitcms order: invalid key head "${head}"`);
}

function integerPart(key: string): string {
	const len = integerLength(key[0] ?? '');
	if (len > key.length) throw new Error(`kitcms order: invalid key "${key}"`);
	return key.slice(0, len);
}

/** Whether `key` is a well-formed order key. */
export function isOrderKey(key: unknown): key is string {
	if (typeof key !== 'string' || key === '' || key === SMALLEST_INTEGER) return false;
	for (const ch of key.slice(1)) if (!DIGITS.includes(ch)) return false;
	try {
		const i = integerPart(key);
		return key.slice(i.length).slice(-1) !== ZERO;
	} catch {
		return false;
	}
}

function assertKey(key: string): void {
	if (!isOrderKey(key)) throw new Error(`kitcms order: invalid key "${key}"`);
}

function incrementInteger(x: string): string | null {
	const [head, ...digs] = x.split('') as [string, ...string[]];
	let carry = true;
	for (let i = digs.length - 1; carry && i >= 0; i--) {
		const d = DIGITS.indexOf(digs[i]!) + 1;
		if (d === DIGITS.length) digs[i] = ZERO;
		else {
			digs[i] = DIGITS[d]!;
			carry = false;
		}
	}
	if (!carry) return head + digs.join('');
	if (head === 'Z') return 'a' + ZERO;
	if (head === 'z') return null;
	const h = String.fromCharCode(head.charCodeAt(0) + 1);
	if (h > 'a') digs.push(ZERO);
	else digs.pop();
	return h + digs.join('');
}

function decrementInteger(x: string): string | null {
	const [head, ...digs] = x.split('') as [string, ...string[]];
	let borrow = true;
	for (let i = digs.length - 1; borrow && i >= 0; i--) {
		const d = DIGITS.indexOf(digs[i]!) - 1;
		if (d === -1) digs[i] = DIGITS.slice(-1);
		else {
			digs[i] = DIGITS[d]!;
			borrow = false;
		}
	}
	if (!borrow) return head + digs.join('');
	if (head === 'a') return 'Z' + DIGITS.slice(-1);
	if (head === 'A') return null;
	const h = String.fromCharCode(head.charCodeAt(0) - 1);
	if (h < 'Z') digs.push(DIGITS.slice(-1));
	else digs.pop();
	return h + digs.join('');
}

/**
 * A key strictly between `a` and `b`. `a = null` means "before everything", `b = null` "after
 * everything". Throws when `a >= b` or a key is malformed.
 */
export function keyBetween(a: string | null, b: string | null): string {
	if (a !== null) assertKey(a);
	if (b !== null) assertKey(b);
	if (a !== null && b !== null && a >= b) throw new Error(`kitcms order: ${a} >= ${b}`);
	if (a === null) {
		if (b === null) return 'a' + ZERO;
		const ib = integerPart(b);
		const fb = b.slice(ib.length);
		if (ib === SMALLEST_INTEGER) return ib + midpoint('', fb);
		if (ib < b) return ib;
		const res = decrementInteger(ib);
		if (res === null) throw new Error('kitcms order: cannot decrement any more');
		return res;
	}
	if (b === null) {
		const ia = integerPart(a);
		const fa = a.slice(ia.length);
		const i = incrementInteger(ia);
		return i === null ? ia + midpoint(fa, null) : i;
	}
	const ia = integerPart(a);
	const fa = a.slice(ia.length);
	const ib = integerPart(b);
	const fb = b.slice(ib.length);
	if (ia === ib) return ia + midpoint(fa, fb);
	const i = incrementInteger(ia);
	if (i === null) throw new Error('kitcms order: cannot increment any more');
	if (i < b) return i;
	return ia + midpoint(fa, null);
}
