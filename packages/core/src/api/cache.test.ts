import { describe, expect, it, vi } from 'vitest';
import type { Cms } from './types';
import {
	bumpGeneration,
	configFingerprint,
	withEdgeCache,
	withEdgeCacheLayer,
	type CacheOptions,
} from './cache';
import type { SanitizedConfig } from '../config/sanitized';

class FakeCache {
	store = new Map<string, Response>();
	puts = 0;
	failMatch = false;
	failPut = false;
	async match(req: string | Request) {
		if (this.failMatch) throw new Error('match failed');
		const r = this.store.get(typeof req === 'string' ? req : req.url);
		return r ? r.clone() : undefined;
	}
	async put(req: string | Request, res: Response) {
		if (this.failPut) throw new Error('put failed');
		this.puts++;
		this.store.set(typeof req === 'string' ? req : req.url, res.clone());
	}
	async delete(req: string | Request) {
		return this.store.delete(typeof req === 'string' ? req : req.url);
	}
}

function setup(over: Partial<CacheOptions> = {}) {
	const cache = new FakeCache();
	const calls = { find: 0, findByID: 0, create: 0, findGlobal: 0 };
	const cms = {
		find: async () => (calls.find++, { docs: [{ id: 'a', n: calls.find }] }),
		findByID: async (_c: string, id: string) => {
			calls.findByID++;
			if (id === 'err') throw new Error('boom');
			return id === 'none' ? null : { id };
		},
		findGlobal: async () => (calls.findGlobal++, { title: 't' }),
		create: async () => (calls.create++, { id: 'new' }),
	} as unknown as Cms;
	const options: CacheOptions = {
		ttl: 60,
		cache: cache as unknown as Cache,
		configId: 'cfg',
		...over,
	};
	return { cache, calls, cms, options };
}

const anon = { user: null };

describe('edge cache', () => {
	it('hits after a miss and returns copies', async () => {
		const { cms, calls, options } = setup();
		const c = withEdgeCache(cms, anon, options);
		const a = (await c.find('posts', { where: { x: 1 } } as never)) as { docs: { id: string }[] };
		const b = (await withEdgeCache(cms, anon, options).find('posts', {
			where: { x: 1 },
		} as never)) as typeof a;
		expect(calls.find).toBe(1);
		expect(b).toEqual(a);
		b.docs[0]!.id = 'mutated';
		const c2 = (await withEdgeCache(cms, anon, options).find('posts', {
			where: { x: 1 },
		} as never)) as typeof a;
		expect(c2.docs[0]!.id).toBe('a');
	});

	it('keys include the add-on gate state (Decision 34): flipping an add-on never serves the old entry', async () => {
		let gates = '1';
		const { cms, calls, options } = setup({ gateKey: async () => gates });
		await withEdgeCache(cms, anon, options).find('posts', {} as never);
		await withEdgeCache(cms, anon, options).find('posts', {} as never);
		expect(calls.find).toBe(1);
		gates = '0';
		await withEdgeCache(cms, anon, options).find('posts', {} as never);
		expect(calls.find).toBe(2);
	});

	it('canonicalizes key order', async () => {
		const { cms, calls, options } = setup();
		const c = withEdgeCache(cms, anon, options);
		await c.find('posts', { where: { a: 1, b: { y: 1, x: 2 } }, limit: 5 } as never);
		await c.find('posts', { limit: 5, where: { b: { x: 2, y: 1 }, a: 1 } } as never);
		expect(calls.find).toBe(1);
	});

	it('does not wrap signed-in users', async () => {
		const { cms, options } = setup();
		expect(withEdgeCache(cms, { user: { id: 'u' } as never }, options)).toBe(cms);
	});

	it.each([
		[{ draft: true }],
		[{ overrideAccess: true }],
		[{ overrideAccess: false }],
		[{ req: {} }],
		[{ context: {} }],
	])('bypasses for %j', async (opts) => {
		const { cms, calls, options, cache } = setup();
		const c = withEdgeCache(cms, anon, options);
		await c.find('posts', opts as never);
		await c.find('posts', opts as never);
		expect(calls.find).toBe(2);
		expect(cache.puts).toBe(0);
	});

	it('a write bumps the generation', async () => {
		const { cms, calls, options } = setup();
		const c = withEdgeCache(cms, anon, options);
		await c.find('posts');
		await c.find('posts');
		expect(calls.find).toBe(1);
		await c.create('posts', {} as never);
		await c.find('posts'); // same instance sees the new generation
		expect(calls.find).toBe(2);
		await withEdgeCache(cms, anon, options).find('posts');
		expect(calls.find).toBe(2);
	});

	it('bumpGeneration from another instance invalidates', async () => {
		const { cms, calls, options } = setup();
		await withEdgeCache(cms, anon, options).find('posts');
		await bumpGeneration(options);
		await withEdgeCache(cms, anon, options).find('posts');
		expect(calls.find).toBe(2);
	});

	it('the layer notifies on signed-in writes', async () => {
		const { cms, calls, options } = setup();
		await withEdgeCacheLayer(cms, anon, options).find('posts');
		await withEdgeCacheLayer(cms, { user: { id: 'u' } as never }, options).create(
			'posts',
			{} as never,
		);
		await withEdgeCacheLayer(cms, anon, options).find('posts');
		expect(calls.find).toBe(2);
	});

	it('caches null but never errors', async () => {
		const { cms, calls, options } = setup();
		const c = withEdgeCache(cms, anon, options);
		expect(await c.findByID('posts', 'none')).toBeNull();
		expect(await c.findByID('posts', 'none')).toBeNull();
		expect(calls.findByID).toBe(1);
		await expect(c.findByID('posts', 'err')).rejects.toThrow('boom');
		await expect(c.findByID('posts', 'err')).rejects.toThrow('boom');
		expect(calls.findByID).toBe(3);
	});

	it('falls back when the cache fails', async () => {
		const { cms, calls, options, cache } = setup();
		cache.failMatch = true;
		cache.failPut = true;
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const c = withEdgeCache(cms, anon, options);
		expect(await c.findGlobal('site')).toEqual({ title: 't' });
		expect(await c.findGlobal('site')).toEqual({ title: 't' });
		expect(calls.findGlobal).toBe(2);
		await expect(c.create('posts', {} as never)).resolves.toEqual({ id: 'new' });
	});

	it('separates configIds', async () => {
		const { cms, calls, options } = setup();
		await withEdgeCache(cms, anon, options).find('posts');
		await withEdgeCache(cms, anon, { ...options, configId: 'other' }).find('posts');
		expect(calls.find).toBe(2);
	});

	it('uses waitUntil for puts and handles concurrent reads', async () => {
		const pending: Promise<unknown>[] = [];
		const { cms, calls, options } = setup({ waitUntil: (p) => void pending.push(p) });
		const c = withEdgeCache(cms, anon, options);
		const [a, b] = await Promise.all([c.find('posts'), c.find('posts')]);
		expect(a).toBeTruthy();
		expect(b).toBeTruthy();
		await Promise.all(pending);
		await c.find('posts');
		expect(calls.find).toBeLessThanOrEqual(2);
		const before = calls.find;
		await c.find('posts');
		expect(calls.find).toBe(before);
	});

	it('passes other methods through', async () => {
		const { cms, options } = setup();
		const c = withEdgeCache(
			{ ...cms, custom: async () => 7 } as unknown as Cms,
			anon,
			options,
		) as unknown as {
			custom(): Promise<number>;
		};
		expect(await c.custom()).toBe(7);
	});
});

describe('configFingerprint', () => {
	const mk = (fields: unknown[]) =>
		({
			collections: [{ slug: 'posts', kind: 'collection', fields }],
			globals: [],
		}) as unknown as SanitizedConfig;
	it('is stable and shape-sensitive', () => {
		const a = configFingerprint(mk([{ name: 't', type: 'text', validate: () => true }]));
		expect(a).toBe(configFingerprint(mk([{ name: 't', type: 'text' }])));
		expect(a).not.toBe(configFingerprint(mk([{ name: 't', type: 'textarea' }])));
	});
});
