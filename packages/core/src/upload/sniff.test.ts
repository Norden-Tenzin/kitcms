import { describe, expect, it } from 'vitest';
import {
	cacheControl,
	clientDimension,
	contentDisposition,
	detectMime,
	makeKey,
	mimeAllowed,
	parseDimensions,
	parseRange,
	safeFilename,
	sniffMime,
	validKey,
} from './sniff';

const bytes = (...n: number[]) => new Uint8Array(n);
const text = (s: string) => new TextEncoder().encode(s);

function png(w: number, h: number): Uint8Array {
	const b = new Uint8Array(33);
	b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const dv = new DataView(b.buffer);
	dv.setUint32(8, 13);
	b.set(text('IHDR'), 12);
	dv.setUint32(16, w);
	dv.setUint32(20, h);
	return b;
}
function gif(w: number, h: number): Uint8Array {
	const b = new Uint8Array(13);
	b.set(text('GIF89a'));
	new DataView(b.buffer).setUint16(6, w, true);
	new DataView(b.buffer).setUint16(8, h, true);
	return b;
}
function jpeg(w: number, h: number): Uint8Array {
	// SOI, APP0 (len 4), SOF0
	const b = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 0, 0, 0, 1, 0, 0, 0]);
	const dv = new DataView(b.buffer);
	dv.setUint16(13, h);
	dv.setUint16(15, w);
	return b;
}
function webpX(w: number, h: number): Uint8Array {
	const b = new Uint8Array(30);
	b.set(text('RIFF'));
	b.set(text('WEBP'), 8);
	b.set(text('VP8X'), 12);
	const W = w - 1;
	const H = h - 1;
	b.set([W & 255, (W >> 8) & 255, (W >> 16) & 255, H & 255, (H >> 8) & 255, (H >> 16) & 255], 24);
	return b;
}

describe('sniffMime', () => {
	it('recognizes formats by content', () => {
		expect(sniffMime(png(1, 1))).toBe('image/png');
		expect(sniffMime(jpeg(1, 1))).toBe('image/jpeg');
		expect(sniffMime(gif(1, 1))).toBe('image/gif');
		expect(sniffMime(webpX(1, 1))).toBe('image/webp');
		expect(sniffMime(text('%PDF-1.7'))).toBe('application/pdf');
		expect(sniffMime(text('<?xml version="1.0"?><svg xmlns=""/>'))).toBe('image/svg+xml');
		expect(sniffMime(text('hello'))).toBeNull();
		const avif = new Uint8Array(16);
		avif.set(text('ftypavif'), 4);
		expect(sniffMime(avif)).toBe('image/avif');
	});
	it('detected type beats the client type; spoofed known types are rejected', () => {
		expect(detectMime(png(1, 1), 'text/plain')).toBe('image/png');
		expect(detectMime(text('<script>alert(1)</script>'), 'image/png')).toBe('application/octet-stream');
		expect(detectMime(text('a,b'), 'text/csv; charset=utf-8')).toBe('text/csv');
	});
});

describe('parseDimensions', () => {
	it('reads headers', () => {
		expect(parseDimensions(png(640, 480), 'image/png')).toEqual({ width: 640, height: 480 });
		expect(parseDimensions(gif(10, 20), 'image/gif')).toEqual({ width: 10, height: 20 });
		expect(parseDimensions(jpeg(300, 200), 'image/jpeg')).toEqual({ width: 300, height: 200 });
		expect(parseDimensions(webpX(800, 600), 'image/webp')).toEqual({ width: 800, height: 600 });
	});
	it('returns null for truncated or zero data', () => {
		expect(parseDimensions(bytes(0x89, 0x50), 'image/png')).toBeNull();
		expect(parseDimensions(png(0, 0), 'image/png')).toBeNull();
		expect(parseDimensions(bytes(0xff, 0xd8, 0xff), 'image/jpeg')).toBeNull();
	});
	it('validates client dimensions', () => {
		expect(clientDimension('120')).toBe(120);
		expect(clientDimension('0')).toBeNull();
		expect(clientDimension('100001')).toBeNull();
		expect(clientDimension('12px')).toBeNull();
		expect(clientDimension(null)).toBeNull();
	});
});

describe('filenames and keys', () => {
	it('sanitizes', () => {
		expect(safeFilename('My Photo (1).JPG')).toBe('my-photo-1.jpg');
		expect(safeFilename('../../etc/passwd')).toBe('passwd');
		expect(safeFilename('.htaccess')).toBe('htaccess');
		expect(safeFilename('日本語.png')).toBe('file.png');
		expect(safeFilename('a'.repeat(300) + '.png').length).toBeLessThanOrEqual(100);
		expect(safeFilename('a'.repeat(300) + '.png').endsWith('.png')).toBe(true);
		expect(makeKey('01ABC', 'x y.png')).toBe('01ABC/x-y.png');
	});
	it('validates served keys', () => {
		expect(validKey('01ABC/x.png')).toBe(true);
		for (const bad of ['', '../x', 'a/../b', 'a//b', '/a', 'a/', 'a\\b', 'a/./b', 'a\u0000b']) {
			expect(validKey(bad)).toBe(false);
		}
	});
});

describe('mimeAllowed', () => {
	it('matches exact, wildcard and any', () => {
		expect(mimeAllowed('image/png', ['image/*'])).toBe(true);
		expect(mimeAllowed('application/pdf', ['image/*'])).toBe(false);
		expect(mimeAllowed('application/pdf', ['image/*', 'application/pdf'])).toBe(true);
		expect(mimeAllowed('anything/x', [])).toBe(true);
		expect(mimeAllowed('image/svg+xml', ['image/png'])).toBe(false);
	});
});

describe('parseRange', () => {
	it('parses', () => {
		expect(parseRange(null, 100)).toEqual({ kind: 'none' });
		expect(parseRange('bytes=0-9', 100)).toEqual({ kind: 'range', start: 0, end: 9 });
		expect(parseRange('bytes=90-', 100)).toEqual({ kind: 'range', start: 90, end: 99 });
		expect(parseRange('bytes=-10', 100)).toEqual({ kind: 'range', start: 90, end: 99 });
		expect(parseRange('bytes=50-500', 100)).toEqual({ kind: 'range', start: 50, end: 99 });
		expect(parseRange('bytes=100-', 100)).toEqual({ kind: 'unsatisfiable' });
		expect(parseRange('bytes=-0', 100)).toEqual({ kind: 'unsatisfiable' });
		expect(parseRange('bytes=0-1,5-6', 100)).toEqual({ kind: 'none' });
		expect(parseRange('items=0-1', 100)).toEqual({ kind: 'none' });
	});
});

describe('serving decisions', () => {
	it('downloads active content', () => {
		expect(contentDisposition('image/png')).toBe('inline');
		expect(contentDisposition('application/pdf')).toBe('inline');
		expect(contentDisposition('video/mp4')).toBe('inline');
		expect(contentDisposition('image/svg+xml')).toBe('attachment');
		expect(contentDisposition('text/html')).toBe('attachment');
		expect(contentDisposition('application/octet-stream')).toBe('attachment');
	});
	it('caches publicly only when anonymous can read', () => {
		expect(cacheControl(true)).toContain('immutable');
		expect(cacheControl(false)).toBe('private, no-store');
	});
});
