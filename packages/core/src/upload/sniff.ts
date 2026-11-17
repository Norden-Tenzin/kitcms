// Pure helpers for uploads: magic-byte MIME detection, image dimensions, key/filename safety,
// MIME matching, range parsing, and serving decisions. No platform APIs.

const ascii = (b: Uint8Array, start: number, len: number): string => {
	let s = '';
	for (let i = start; i < start + len && i < b.length; i++) s += String.fromCharCode(b[i]!);
	return s;
};

/** The MIME type for recognized formats (by content), else `null`. */
export function sniffMime(b: Uint8Array): string | null {
	if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'image/png';
	if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
	if (ascii(b, 0, 4) === 'GIF8') return 'image/gif';
	if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
	if (ascii(b, 0, 5) === '%PDF-') return 'application/pdf';
	if (ascii(b, 4, 4) === 'ftyp') {
		const brand = ascii(b, 8, 4);
		if (brand === 'avif' || brand === 'avis') return 'image/avif';
		return 'video/mp4';
	}
	if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
	// SVG: text containing an <svg element near the start.
	const head = ascii(b, 0, 1024).replace(new RegExp('^' + String.fromCharCode(0xfeff)), '').trimStart().toLowerCase();
	if ((head.startsWith('<?xml') || head.startsWith('<svg') || head.startsWith('<!--') || head.startsWith('<!doctype svg')) && head.includes('<svg')) {
		return 'image/svg+xml';
	}
	return null;
}

/** Detected type wins; the client's type is only used for formats we can't recognize. */
export function detectMime(bytes: Uint8Array, clientType: string): string {
	const sniffed = sniffMime(bytes);
	if (sniffed) return sniffed;
	const t = clientType.split(';')[0]!.trim().toLowerCase();
	// A client may not claim a type we can sniff but didn't find (e.g. "image/png" with other bytes).
	if (/^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|application\/pdf|video\/(mp4|webm))$/.test(t)) {
		return 'application/octet-stream';
	}
	return t || 'application/octet-stream';
}

/** `mimeTypes` entries are exact or `type/*`; `[]` allows anything. */
export function mimeAllowed(mime: string, allowed: readonly string[]): boolean {
	if (allowed.length === 0) return true;
	const m = mime.toLowerCase();
	return allowed.some((a) => {
		const p = a.toLowerCase();
		return p.endsWith('/*') ? m.startsWith(p.slice(0, -1)) : m === p;
	});
}

export interface Dimensions {
	width: number;
	height: number;
}

export function parseDimensions(b: Uint8Array, mime: string): Dimensions | null {
	const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
	const ok = (w: number, h: number) => (w > 0 && h > 0 ? { width: w, height: h } : null);
	try {
		if (mime === 'image/png') {
			if (b.length < 24) return null;
			return ok(dv.getUint32(16), dv.getUint32(20));
		}
		if (mime === 'image/gif') {
			if (b.length < 10) return null;
			return ok(dv.getUint16(6, true), dv.getUint16(8, true));
		}
		if (mime === 'image/jpeg') {
			let i = 2;
			while (i + 9 < b.length) {
				if (b[i] !== 0xff) {
					i++;
					continue;
				}
				const marker = b[i + 1]!;
				if (marker === 0xff) {
					i++;
					continue;
				}
				if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
					i += 2;
					continue;
				}
				const len = dv.getUint16(i + 2);
				if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
					return ok(dv.getUint16(i + 7), dv.getUint16(i + 5));
				}
				if (len < 2) return null;
				i += 2 + len;
			}
			return null;
		}
		if (mime === 'image/webp') {
			if (b.length < 30) return null;
			const chunk = ascii(b, 12, 4);
			if (chunk === 'VP8 ') {
				return ok(dv.getUint16(26, true) & 0x3fff, dv.getUint16(28, true) & 0x3fff);
			}
			if (chunk === 'VP8L') {
				const bits = dv.getUint32(21, true);
				return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
			}
			if (chunk === 'VP8X') {
				const w = (b[24]! | (b[25]! << 8) | (b[26]! << 16)) + 1;
				const h = (b[27]! | (b[28]! << 8) | (b[29]! << 16)) + 1;
				return ok(w, h);
			}
		}
	} catch {
		return null;
	}
	return null;
}

/** A positive integer ≤ 100000 from a client-sent form value, else `null`. */
export function clientDimension(v: unknown): number | null {
	if (typeof v !== 'string' || !/^\d{1,6}$/.test(v)) return null;
	const n = Number(v);
	return n > 0 && n <= 100000 ? n : null;
}

/** Lowercased, `[a-z0-9._-]`, max 100 chars, extension kept. Never empty. */
export function safeFilename(name: string): string {
	const base = name.split(/[\\/]/).pop() ?? '';
	const s = base
		.normalize('NFKD')
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/-{2,}/g, '-');
	const dot = s.lastIndexOf('.');
	let ext = dot > 0 ? s.slice(dot) : '';
	if (ext.length > 12) ext = ext.slice(0, 12);
	let stem = dot > 0 ? s.slice(0, dot) : s;
	stem = stem.replace(/^[.-]+/, '').slice(0, Math.max(1, 100 - ext.length)).replace(/-+$/, '');
	return (stem || 'file') + ext;
}

export function makeKey(id: string, filename: string): string {
	return `${id}/${safeFilename(filename)}`;
}

/** Valid served keys: no empty segments, `.`/`..`, backslashes, NULs or control characters. */
export function validKey(key: string): boolean {
	if (!key || key.length > 300 || key.includes('\\')) return false;
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(key)) return false;
	return key.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

export type RangeResult =
	| { kind: 'none' }
	| { kind: 'unsatisfiable' }
	| { kind: 'range'; start: number; end: number };

/** Single `bytes=` range only; multi-range or malformed headers are ignored (full response). */
export function parseRange(header: string | null, size: number): RangeResult {
	if (!header) return { kind: 'none' };
	const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!m) return { kind: 'none' };
	const [, a, b] = m;
	if (a === '' && b === '') return { kind: 'none' };
	if (a === '') {
		const n = Number(b);
		if (n === 0 || size === 0) return { kind: 'unsatisfiable' };
		return { kind: 'range', start: Math.max(0, size - n), end: size - 1 };
	}
	const start = Number(a);
	if (start >= size) return { kind: 'unsatisfiable' };
	const end = b === '' ? size - 1 : Math.min(Number(b), size - 1);
	if (end < start) return { kind: 'none' };
	return { kind: 'range', start, end };
}

const INLINE = /^(image\/(png|jpeg|gif|webp|avif|bmp|x-icon)|video\/|audio\/|application\/pdf$)/;

/** SVG and everything not clearly a passive media type is downloaded, never rendered. */
export function contentDisposition(mime: string): 'inline' | 'attachment' {
	return INLINE.test(mime.toLowerCase()) ? 'inline' : 'attachment';
}

export const MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

export function cacheControl(publiclyReadable: boolean): string {
	return publiclyReadable ? 'public, max-age=31536000, immutable' : 'private, no-store';
}
