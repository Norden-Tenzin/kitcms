// Per-isolate runtime wiring shared by the SvelteKit handle and the RPC entrypoint:
// bindings → adapters, cached per binding object.
import type { PipelineStorage } from './api/local';
import type { SanitizedConfig } from './config/sanitized';
import type { DbAdapter } from './db/adapter';
import { createD1Adapter } from './db/d1';
import type { SessionStart } from './db/session';
import type { StorageAdapter } from './storage/adapter';
import { createR2Adapter } from './storage/r2';

/**
 * A D1 adapter for ONE request (§13.10): a fresh `withSession(start)` wrapped around the binding,
 * so reads may hit a replica and writes are sequentially consistent. Expensive parts (Drizzle
 * tables) are cached per config in `getTables`; this only wraps. Without `withSession` (older
 * runtimes) it falls back to the raw binding. Better Auth keeps the raw binding (primary).
 */
export function dbFor(
	config: SanitizedConfig,
	env: Record<string, unknown>,
	start: SessionStart = 'first-unconstrained',
): DbAdapter {
	const binding = env[config.bindings.db] as D1Database | undefined;
	if (!binding) {
		throw new Error(
			`kitcms: the D1 binding "${config.bindings.db}" is missing. Add it to wrangler.jsonc (d1_databases).`,
		);
	}
	return createD1Adapter(config, typeof binding.withSession === 'function' ? binding.withSession(start) : binding);
}

const storages = new WeakMap<object, StorageAdapter>();

/**
 * The R2 storage adapter, or `undefined` when no collection has `upload`. Throws when an upload
 * collection exists but the bucket binding is missing.
 */
export function storageAdapterFor(
	config: SanitizedConfig,
	env: Record<string, unknown>,
	base: () => string = () => '',
): StorageAdapter | undefined {
	if (!config.collections.some((c) => c.upload)) return undefined;
	const binding = env[config.bindings.bucket] as R2Bucket | undefined;
	if (!binding) {
		throw new Error(
			`kitcms: the R2 binding "${config.bindings.bucket}" is missing. Add it to wrangler.jsonc (r2_buckets).`,
		);
	}
	const cached = storages.get(binding);
	if (cached) return cached;
	const s = createR2Adapter(binding, { publicUrl: config.media.publicUrl, base });
	storages.set(binding, s);
	return s;
}

/** File storage for the pipeline (R2). */
export function storageFor(
	config: SanitizedConfig,
	env: Record<string, unknown>,
	base: () => string = () => '',
): PipelineStorage | undefined {
	return storageAdapterFor(config, env, base);
}

/** The Worker var that makes a deployment read-only (e.g. a paused site): `1` or `true`. */
export const READ_ONLY_VAR = 'KITCMS_READ_ONLY';

/** Whether this deployment is read-only (`KITCMS_READ_ONLY=1`). Every content write is refused. */
export function isReadOnly(env: Record<string, unknown>): boolean {
	const v = env[READ_ONLY_VAR];
	return v === true || (typeof v === 'string' && ['1', 'true', 'yes'].includes(v.trim().toLowerCase()));
}
