// Edge cache for anonymous published reads (plan §13.9, Decision 27).
//
// Workers Cache API, per colo. Every key carries a *generation* token stored in the same cache;
// any write replaces the token, so earlier entries are simply never read again. Other colos keep
// serving their own entries until `ttl` expires (no cross-colo invalidation). The Cache API is a
// no-op on `*.workers.dev`; it needs a custom domain.
//
// Wiring: wrap every request's Cms with `withEdgeCacheLayer`. Anonymous Cms get the read cache
// plus write invalidation; signed-in Cms are only wrapped so their writes bump the generation.

import type { KitcmsUser } from '../config/hooks';
import type { SanitizedConfig } from '../config/sanitized';
import type { Cms } from './types';

export interface CacheOptions {
	/** Seconds (config.cache.ttl). */
	ttl: number;
	/** Default: `caches.default` (Workers Cache API). Injectable for tests. */
	cache?: Cache;
	waitUntil?: (p: Promise<unknown>) => void;
	/** Stable id of the config/schema; part of every key so a new schema never reads old entries. */
	configId: string;
	/**
	 * The current on/off state of every gated add-on (Decision 34), e.g. `"10"`. Part of every key,
	 * so flipping an add-on never serves a read cached under the other state (direct or populated).
	 */
	gateKey?: () => Promise<string>;
}

const ORIGIN = 'https://kitcms.cache';
const READS = new Set(['find', 'findOne', 'findByID', 'count', 'findGlobal']);
const WRITES = new Set([
	'create',
	'update',
	'delete',
	'move',
	'unpublish',
	'updateGlobal',
	'restoreVersion',
	'restoreGlobalVersion',
]);
/** The generation entry outlives every value entry. */
const GEN_MIN_AGE = 86_400;

let warned = false;
function warnOnce(error: unknown): void {
	if (warned) return;
	warned = true;
	console.warn('[kitcms] edge cache unavailable, falling back to uncached reads:', error);
}

function resolveCache(options: CacheOptions): Cache | undefined {
	if (options.cache) return options.cache;
	return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

function newToken(): string {
	return crypto.randomUUID();
}

function textResponse(body: string, contentType: string, maxAge: number): Response {
	return new Response(body, {
		headers: { 'content-type': contentType, 'cache-control': `public, max-age=${maxAge}` },
	});
}

const genUrl = (o: CacheOptions) => `${ORIGIN}/${encodeURIComponent(o.configId)}/gen`;

/** Reads the current generation token, creating one when missing. Never throws. */
async function readGeneration(options: CacheOptions): Promise<string | undefined> {
	const cache = resolveCache(options);
	if (!cache) return undefined;
	try {
		const hit = await cache.match(genUrl(options));
		if (hit) {
			const token = await hit.text();
			if (token) return token;
		}
		const token = newToken();
		await cache.put(
			genUrl(options),
			textResponse(token, 'text/plain', Math.max(GEN_MIN_AGE, options.ttl)),
		);
		return token;
	} catch (error) {
		warnOnce(error);
		return undefined;
	}
}

/**
 * Invalidates this colo's entries: writes a new generation token. Call after any successful write
 * made through a Cms that is not wrapped by `withEdgeCache`. Never throws.
 */
export async function bumpGeneration(options: CacheOptions): Promise<string | undefined> {
	const cache = resolveCache(options);
	if (!cache) return undefined;
	const token = newToken();
	try {
		await cache.put(
			genUrl(options),
			textResponse(token, 'text/plain', Math.max(GEN_MIN_AGE, options.ttl)),
		);
		return token;
	} catch (error) {
		warnOnce(error);
		return undefined;
	}
}

/** JSON with object keys sorted recursively. Throws on values that are not plain JSON data. */
function canonicalize(value: unknown): string {
	const walk = (v: unknown): unknown => {
		if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
		if (typeof v === 'number') {
			if (!Number.isFinite(v)) throw new Error('non-finite number');
			return v;
		}
		if (v === undefined) return null;
		if (Array.isArray(v)) return v.map(walk);
		if (v instanceof Date) return v.toISOString();
		if (typeof v === 'object') {
			const proto = Object.getPrototypeOf(v);
			if (proto !== Object.prototype && proto !== null) throw new Error('non-plain object');
			const out: Record<string, unknown> = {};
			for (const k of Object.keys(v as object).sort()) {
				const x = (v as Record<string, unknown>)[k];
				if (x !== undefined) out[k] = walk(x);
			}
			return out;
		}
		throw new Error(`unsupported ${typeof v}`);
	};
	return JSON.stringify(walk(value));
}

async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The options argument (last arg) of a read method. */
function optionsArg(method: string, args: unknown[]): unknown {
	return method === 'findByID' ? args[2] : args[1];
}

function cacheable(method: string, args: unknown[]): boolean {
	const opts = optionsArg(method, args);
	if (opts === undefined || opts === null) return true;
	if (typeof opts !== 'object' || Array.isArray(opts)) return false;
	const o = opts as Record<string, unknown>;
	if (o.draft === true) return false;
	if (o.overrideAccess !== undefined || o.req !== undefined || o.context !== undefined)
		return false;
	return true;
}

function bind(target: Cms, prop: string | symbol): unknown {
	const v = Reflect.get(target, prop, target);
	return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
}

/** Wraps `cms` so every successful (or attempted) write bumps the generation. */
function wrapWrites(
	cms: Cms,
	options: CacheOptions,
	onBump?: (token: Promise<string | undefined>) => void,
	readsOverride?: (
		method: string,
		args: unknown[],
		call: () => Promise<unknown>,
	) => Promise<unknown>,
): Cms {
	return new Proxy(cms, {
		get(target, prop) {
			const name = typeof prop === 'string' ? prop : '';
			const original = bind(target, prop);
			if (typeof original !== 'function') return original;
			if (WRITES.has(name)) {
				return async (...args: unknown[]) => {
					try {
						return await (original as (...a: unknown[]) => Promise<unknown>)(...args);
					} finally {
						// Also on failure: an after-hook may throw after the row was written.
						const bump = bumpGeneration(options);
						onBump?.(bump);
						await bump;
					}
				};
			}
			if (readsOverride && READS.has(name)) {
				return (...args: unknown[]) =>
					readsOverride(name, args, () =>
						(original as (...a: unknown[]) => Promise<unknown>)(...args),
					);
			}
			return original;
		},
	});
}

/** Signed-in users: no read caching, but their writes still invalidate. */
export function withWriteNotifier(cms: Cms, options: CacheOptions): Cms {
	return wrapWrites(cms, options);
}

/**
 * Wraps a Local API with the anonymous read cache. Returns `cms` unchanged when `user !== null`
 * (use `withEdgeCacheLayer` to also invalidate on signed-in writes).
 */
export function withEdgeCache(
	cms: Cms,
	ctx: { user: KitcmsUser | null },
	options: CacheOptions,
): Cms {
	if (ctx.user !== null) return cms;
	let generation: Promise<string | undefined> | undefined;
	const gen = () => (generation ??= readGeneration(options));

	const read = async (method: string, args: unknown[], call: () => Promise<unknown>) => {
		if (!cacheable(method, args)) return call();
		const cache = resolveCache(options);
		if (!cache) return call();

		let url: string;
		try {
			const token = await gen();
			if (!token) return call();
			const hash = await sha256Hex(canonicalize(args));
			const gates = options.gateKey ? `g${await options.gateKey()}/` : '';
			url = `${ORIGIN}/${encodeURIComponent(options.configId)}/${gates}${token}/${method}/${hash}`;
		} catch {
			return call(); // args that cannot be canonicalized are simply not cached
		}

		try {
			const hit = await cache.match(url);
			if (hit) return (await hit.json()) as unknown;
		} catch (error) {
			warnOnce(error);
		}

		const result = await call(); // errors propagate and are never cached
		const body = JSON.stringify(result === undefined ? null : result);
		if (result !== undefined && body !== undefined) {
			const put = Promise.resolve()
				.then(() => cache.put(url, textResponse(body, 'application/json', options.ttl)))
				.catch(warnOnce);
			if (options.waitUntil) options.waitUntil(put);
			else await put;
		}
		return result;
	};

	return wrapWrites(
		cms,
		options,
		(bump) => {
			generation = bump; // later reads in this request use the new generation
		},
		read,
	);
}

/** Single wiring point: the right wrapper for the caller. */
export function withEdgeCacheLayer(
	cms: Cms,
	ctx: { user: KitcmsUser | null },
	options: CacheOptions,
): Cms {
	return ctx.user === null ? withEdgeCache(cms, ctx, options) : withWriteNotifier(cms, options);
}

// Fields whose value shapes the stored/returned document.
const SHAPE_KEYS = [
	'name',
	'type',
	'slug',
	'kind',
	'globalSlug',
	'fields',
	'blocks',
	'hasMany',
	'relationTo',
	'localized',
	'drafts',
];

/** A cheap stable hash of the config shape (collections/globals/field names+types), for `configId`. */
export function configFingerprint(config: SanitizedConfig): string {
	const shape = (v: unknown): unknown => {
		if (Array.isArray(v)) return v.map(shape);
		if (v && typeof v === 'object') {
			const out: Record<string, unknown> = {};
			for (const k of SHAPE_KEYS) {
				const x = (v as Record<string, unknown>)[k];
				if (x !== undefined && typeof x !== 'function') out[k] = shape(x);
			}
			return out;
		}
		return typeof v === 'function' ? undefined : v;
	};
	const text = JSON.stringify([shape(config.collections), shape(config.globals)]);
	// cyrb53
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i++) {
		const ch = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
