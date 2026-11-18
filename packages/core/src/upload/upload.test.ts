// handleUpload + serveMedia against Miniflare D1 + R2.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: undefined }));
vi.mock('$app/paths', () => ({ base: '', resolve: (p: string) => p }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('no request event');
	},
}));
vi.mock('$app/env', () => ({ dev: true, building: false }));

import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { createSchemaStatements } from '../../test/d1';
import { createLocalApi } from '../api/local';
import { collection, defineConfig } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';
import { createR2Adapter } from '../storage/r2';
import type { KitcmsInternals } from '../sveltekit/index';
import { handleUpload } from './handler';
import { serveMediaWith } from './serve';

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({
				slug: 'media',
				upload: { mimeTypes: ['image/*'], maxFileSize: 2000 },
				access: { read: () => true, create: () => true, update: () => true, delete: () => true },
				fields: { alt: f.text() },
			}),
			collection({
				slug: 'private',
				upload: true,
				access: { read: ({ req }) => !!req.user, create: () => true, update: () => true },
				fields: {},
			}),
		],
	}),
);

let mf: Miniflare;
let d1: D1Database;
let bucket: R2Bucket;
const admin = { id: 'u1', email: 'a@b.c', role: 'admin' } as unknown as KitcmsUser;

function internals(user: KitcmsUser | null): KitcmsInternals {
	const db = createD1Adapter(config, d1);
	const storage = createR2Adapter(bucket, { base: () => '' });
	const cmsFor = (u: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') =>
		createLocalApi({ config, db, storage, user: u, source });
	return { config, options: { config: {} as never }, db, env: {}, cms: cmsFor(user), user, cmsFor, storage };
}

function png(w: number, h: number, pad = 0): Uint8Array<ArrayBuffer> {
	const b = new Uint8Array(33 + pad);
	b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const dv = new DataView(b.buffer);
	dv.setUint32(8, 13);
	b.set(new TextEncoder().encode('IHDR'), 12);
	dv.setUint32(16, w);
	dv.setUint32(20, h);
	return b;
}

function uploadEvent(fields: Record<string, string | File>) {
	const form = new FormData();
	for (const [k, v] of Object.entries(fields)) form.set(k, v);
	const request = new Request('http://x/api/upload/media', { method: 'POST', body: form });
	return { request, url: new URL(request.url), locals: {} } as never;
}
function getEvent(headers: Record<string, string> = {}) {
	const request = new Request('http://x/api/media/k', { headers });
	return { request, url: new URL(request.url), locals: {} } as never;
}

beforeAll(async () => {
	mf = new Miniflare(
		convertV4MiniflareOptions({
			modules: true,
			script: 'export default { fetch() { return new Response() } }',
			d1Databases: ['DB'],
			r2Buckets: ['BUCKET'],
		}),
	);
	d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
	bucket = (await mf.getR2Bucket('BUCKET')) as unknown as R2Bucket;
	for (const stmt of await createSchemaStatements(config)) {
		for (const part of stmt.split('--> statement-breakpoint')) {
			if (part.trim()) await d1.prepare(part.trim()).run();
		}
	}
});
afterAll(async () => {
	await mf.dispose();
});

describe('upload + serve', () => {
	it('stores the file, derives type and size from content, and serves it', async () => {
		const k = internals(admin);
		const file = new File([png(640, 480)], 'My Photo.PNG', { type: 'text/html' });
		const res = await handleUpload(uploadEvent({ file, alt: 'hi', width: '1', height: '1' }), k, 'media');
		expect(res.status).toBe(201);
		const body = (await res.json()) as { id: string; mimeType: string; width: number; height: number; doc: Record<string, unknown> };
		expect(body.mimeType).toBe('image/png');
		expect([body.width, body.height]).toEqual([640, 480]);
		expect(body.doc.alt).toBe('hi');
		const key = body.doc.key as string;
		expect(key).toMatch(/^[0-9A-Z]{26}\/my-photo\.png$/);
		expect(await bucket.head(key)).not.toBeNull();

		// anonymous request: public + cacheable
		const anon = await serveMediaWith(getEvent(), internals(null), key);
		expect(anon.status).toBe(200);
		expect(anon.headers.get('cache-control')).toContain('immutable');
		expect(anon.headers.get('x-content-type-options')).toBe('nosniff');
		expect(anon.headers.get('content-security-policy')).toContain('sandbox');
		expect(anon.headers.get('content-type')).toBe('image/png');
		const etag = anon.headers.get('etag')!;
		await anon.arrayBuffer();

		const nm = await serveMediaWith(getEvent({ 'if-none-match': etag }), internals(null), key);
		expect(nm.status).toBe(304);

		const part = await serveMediaWith(getEvent({ range: 'bytes=0-3' }), internals(null), key);
		expect(part.status).toBe(206);
		expect(part.headers.get('content-range')).toBe('bytes 0-3/33');
		expect(new Uint8Array(await part.arrayBuffer())).toEqual(png(1, 1).slice(0, 4));

		const bad = await serveMediaWith(getEvent({ range: 'bytes=500-' }), internals(null), key);
		expect(bad.status).toBe(416);

		// signed-in on a public collection is still cacheable publicly
		const signed = await serveMediaWith(getEvent(), internals(admin), key);
		expect(signed.headers.get('cache-control')).toContain('public');
		await signed.arrayBuffer();
	});

	it('rejects bad types, sizes and spoofed content', async () => {
		const k = internals(admin);
		const spoof = new File(['<script>alert(1)</script>'], 'a.png', { type: 'image/png' });
		expect((await handleUpload(uploadEvent({ file: spoof }), k, 'media')).status).toBe(415);
		const pdf = new File(['%PDF-1.4 x'], 'a.pdf', { type: 'application/pdf' });
		expect((await handleUpload(uploadEvent({ file: pdf }), k, 'media')).status).toBe(415);
		const big = new File([png(1, 1, 3000)], 'big.png');
		expect((await handleUpload(uploadEvent({ file: big }), k, 'media')).status).toBe(413);
		expect((await handleUpload(uploadEvent({}), k, 'media')).status).toBe(400);
		expect((await handleUpload(uploadEvent({ file: pdf }), k, 'nope')).status).toBe(404);
	});

	it('cleans up the R2 object when create fails', async () => {
		const before = (await bucket.list()).objects.length;
		const k = internals(admin);
		// alt is text; an invalid JSON-ish value is fine, so force failure with a too-long unknown path:
		const failing = { ...k, cmsFor: () => ({ ...k.cms, create: async () => { throw new Error('boom'); } }) as never } as KitcmsInternals;
		const file = new File([png(2, 2)], 'c.png');
		await expect(handleUpload(uploadEvent({ file }), failing, 'media')).rejects.toThrow('boom');
		expect((await bucket.list()).objects.length).toBe(before);
	});

	it('replaces a file and removes the old object', async () => {
		const k = internals(admin);
		const first = (await (await handleUpload(uploadEvent({ file: new File([png(3, 3)], 'r.png') }), k, 'media')).json()) as { id: string; doc: { key: string } };
		const res = await handleUpload(uploadEvent({ file: new File([png(5, 6)], 'r2.png'), id: first.id }), k, 'media');
		expect(res.status).toBe(200);
		const second = (await res.json()) as { width: number; doc: { key: string } };
		expect(second.width).toBe(5);
		expect(await bucket.head(first.doc.key)).toBeNull();
		expect(await bucket.head(second.doc.key)).not.toBeNull();
		const missing = await handleUpload(uploadEvent({ file: new File([png(3, 3)], 'r.png'), id: 'nope' }), k, 'media');
		expect(missing.status).toBe(404);
	});

	it('hides unreadable files and marks readable-only-when-signed-in files private', async () => {
		const k = internals(admin);
		const res = await handleUpload(uploadEvent({ file: new File(['hello'], 'n.txt', { type: 'text/plain' }) }), k, 'private');
		expect(res.status).toBe(201);
		const { doc } = (await res.json()) as { doc: { key: string } };
		expect((await serveMediaWith(getEvent(), internals(null), doc.key)).status).toBe(404);
		const signed = await serveMediaWith(getEvent(), internals(admin), doc.key);
		expect(signed.status).toBe(200);
		expect(signed.headers.get('cache-control')).toBe('private, no-store');
		expect(signed.headers.get('content-disposition')).toContain('attachment');
		await signed.arrayBuffer();
		expect((await serveMediaWith(getEvent(), internals(admin), '../x')).status).toBe(404);
		expect((await serveMediaWith(getEvent(), internals(admin), 'nope/x.png')).status).toBe(404);
	});
});
