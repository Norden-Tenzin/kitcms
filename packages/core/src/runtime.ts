// Per-isolate runtime wiring shared by the SvelteKit handle and the RPC entrypoint:
// bindings → adapters, cached per binding object.
import type { PipelineStorage } from './api/local';
import type { SanitizedConfig } from './config/sanitized';
import type { DbAdapter } from './db/adapter';
import { createD1Adapter } from './db/d1';
import type { StorageAdapter } from './storage/adapter';
import { createR2Adapter } from './storage/r2';

const adapters = new WeakMap<object, DbAdapter>();

export function dbFor(config: SanitizedConfig, env: Record<string, unknown>): DbAdapter {
	const binding = env[config.bindings.db] as D1Database | undefined;
	if (!binding) {
		throw new Error(
			`kitcms: the D1 binding "${config.bindings.db}" is missing. Add it to wrangler.jsonc (d1_databases).`,
		);
	}
	const cached = adapters.get(binding);
	if (cached) return cached;
	const db = createD1Adapter(config, binding);
	adapters.set(binding, db);
	return db;
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
