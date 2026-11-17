// Edge cache wired into createLocalApi (§13.9): anonymous published reads hit the cache,
// signed-in users and drafts never do, and any write invalidates.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../test/d1';
import { collection, defineConfig } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import { createD1Adapter } from '../db/d1';
import { createLocalApi } from './local';
import type { Cms } from './types';

class MemCache {
	store = new Map<string, Response>();
	async match(req: string | Request) {
		const r = this.store.get(typeof req === 'string' ? req : req.url);
		return r ? r.clone() : undefined;
	}
	async put(req: string | Request, res: Response) {
		this.store.set(typeof req === 'string' ? req : req.url, res.clone());
	}
	async delete(req: string | Request) {
		return this.store.delete(typeof req === 'string' ? req : req.url);
	}
}

const config = sanitizeConfig(
	defineConfig({
		cache: { ttl: 60 },
		collections: [
			collection({
				slug: 'posts',
				versions: { drafts: true },
				access: { read: () => true },
				fields: { title: f.text() },
			}),
		],
	}),
);
const admin: KitcmsUser = { id: 'a', email: 'a@x.io', name: 'A', role: 'admin', collection: 'users' };

let db: TestDb;
let batches = 0;
let as: (user: KitcmsUser | null) => Cms;
const g = globalThis as { caches?: unknown };
const prevCaches = g.caches;

beforeAll(async () => {
	g.caches = { default: new MemCache() };
	db = await createTestDb(config);
	const d1 = db.d1;
	const counted = new Proxy(d1, {
		get(target, prop, receiver) {
			const v = Reflect.get(target, prop, receiver) as unknown;
			if (prop === 'batch' && typeof v === 'function') {
				return (...args: unknown[]) => {
					batches++;
					return (v as (...a: unknown[]) => unknown).apply(target, args);
				};
			}
			return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
		},
	});
	const adapter = createD1Adapter(config, counted);
	// A new Local API per call = a new request.
	as = (user) => createLocalApi({ config, db: adapter, user, source: 'local' });
});
afterAll(async () => {
	g.caches = prevCaches;
	await db.dispose();
});

describe('edge cache in the Local API', () => {
	it('serves repeated anonymous reads from the cache and invalidates on writes', async () => {
		const post = await as(admin).create('posts', { title: 'v1' });
		const first = await as(null).findByID('posts', post.id);
		expect(first?.title).toBe('v1');
		batches = 0;
		const again = await as(null).findByID('posts', post.id);
		expect(again?.title).toBe('v1');
		expect(batches).toBe(0);

		// A signed-in write (not wrapped by the read cache) still invalidates.
		await as(admin).update('posts', post.id, { title: 'v2' });
		expect((await as(null).findByID('posts', post.id))?.title).toBe('v2');
	});

	it('never caches signed-in or draft reads, and never shows drafts to anonymous callers', async () => {
		const post = await as(admin).create('posts', { title: 'pub' });
		await as(null).findByID('posts', post.id); // warm
		await as(admin).update('posts', post.id, { title: 'draft' }, { draft: true });
		batches = 0;
		expect((await as(admin).findByID('posts', post.id, { draft: true }))?.title).toBe('draft');
		expect((await as(admin).findByID('posts', post.id))?.title).toBe('pub');
		expect(batches).toBe(2);
		expect((await as(null).findByID('posts', post.id))?.title).toBe('pub');
		await expect(as(null).findByID('posts', post.id, { draft: true })).rejects.toThrow();
	});
});
