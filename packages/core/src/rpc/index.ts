// Service Binding RPC (plan §2.2, Decision 14). SECURITY-CRITICAL: changes need Opus review + tests.
//
// The app's generated `src/kitcms.rpc.ts`:
//   import { createKitcmsRPC } from '@kitcms/core/rpc';
//   import config from './kitcms.config';
//   export const KitcmsRPC = createKitcmsRPC(config);
// Consumers bind to it (`entrypoint = "KitcmsRPC"`) and call it through `@kitcms/client`.
//
// TRUST MODEL
// - A Service Binding is private: only Workers in the same account that declare the binding can
//   call it. Calls still go through the full pipeline (access → hooks → D1 → hooks).
// - Default caller: ANONYMOUS (`user: null`, source `rpc`). It sees exactly what a signed-out
//   visitor sees: collection read rules, `where` filters and field read access all apply.
// - `{ as: 'system' }`: the caller is trusted server code. Reads run with `overrideAccess: true`
//   (no collection or field access rules). Hooks still run. Use it only from Workers you control.
// - The surface is READ-ONLY in v1: find, findOne, findByID, count, getMediaUrl. (Writes, only for
//   `as: 'system'`, are Phase 2.)
// - Options from the caller are untrusted structured-clone data: only whitelisted keys are
//   copied, with type checks. `overrideAccess`, `req`, `context` or anything else the caller sends
//   is never passed to the Local API.
// - Errors cross the boundary as `Error` with the message `kitcms:<CODE>:<status>: <message>`
//   (custom error properties don't survive RPC); `@kitcms/client` turns them back into typed errors.
// - `{ tenant }` (multi-tenant plugin, Phase 3) is not accepted yet.

import { WorkerEntrypoint } from 'cloudflare:workers';
import { createLocalApi } from '../api/local';
import type { Cms } from '../api/types';
import type { Config } from '../config/collection';
import { sanitizeConfig } from '../config/sanitize';
import type { SanitizedConfig } from '../config/sanitized';
import type { WhereInput } from '../config/where';
import { isKitcmsError, QueryError } from '../errors';
import { dbFor, storageFor } from '../runtime';

/** Options a consumer may pass to `find` / `findOne`. */
export interface RpcFindOptions {
	where?: WhereInput;
	sort?: string;
	limit?: number;
	page?: number;
	depth?: number;
	pagination?: boolean;
	/** `'system'` = trusted caller: reads skip access rules. Default: anonymous. */
	as?: 'system';
}
export interface RpcReadOptions {
	depth?: number;
	as?: 'system';
}
export interface RpcCountOptions {
	where?: WhereInput;
	as?: 'system';
}

/** The RPC surface, as seen by `@kitcms/client`. */
export interface KitcmsRPCMethods {
	find(collection: string, options?: RpcFindOptions): Promise<unknown>;
	findOne(collection: string, options?: Omit<RpcFindOptions, 'limit' | 'page' | 'pagination'>): Promise<unknown>;
	findByID(collection: string, id: string, options?: RpcReadOptions): Promise<unknown>;
	count(collection: string, options?: RpcCountOptions): Promise<number>;
	getMediaUrl(key: string): Promise<string | null>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** Whitelists caller options. Unknown keys are rejected loudly (a typo shouldn't silently widen nothing). */
export function readRpcOptions(
	raw: unknown,
	allowed: readonly ('where' | 'sort' | 'limit' | 'page' | 'depth' | 'pagination' | 'as')[],
): { system: boolean; args: Record<string, unknown> } {
	if (raw === undefined || raw === null) return { system: false, args: {} };
	if (!isPlainObject(raw)) throw new QueryError('options must be an object.');
	const args: Record<string, unknown> = {};
	let system = false;
	for (const [key, value] of Object.entries(raw)) {
		if (value === undefined) continue;
		if (!(allowed as readonly string[]).includes(key)) throw new QueryError(`Unknown option "${key}".`);
		switch (key) {
			case 'as':
				if (value !== 'system') throw new QueryError('`as` must be "system".');
				system = true;
				break;
			case 'where':
				if (!isPlainObject(value)) throw new QueryError('`where` must be an object.');
				args.where = value;
				break;
			case 'sort':
				if (typeof value !== 'string') throw new QueryError('`sort` must be a string.');
				args.sort = value;
				break;
			case 'pagination':
				if (typeof value !== 'boolean') throw new QueryError('`pagination` must be a boolean.');
				args.pagination = value;
				break;
			default: // limit, page, depth: validated by the Local API
				if (typeof value !== 'number') throw new QueryError(`\`${key}\` must be a number.`);
				args[key] = value;
		}
	}
	return { system, args };
}

function requireString(value: unknown, name: string): string {
	if (typeof value !== 'string' || value === '') throw new QueryError(`\`${name}\` must be a non-empty string.`);
	return value;
}

/** Encodes kitcms errors so code and status survive the RPC boundary. */
function rethrow(err: unknown): never {
	if (isKitcmsError(err)) throw new Error(`kitcms:${err.code}:${err.status}: ${err.message}`);
	throw err;
}

/** A Local API for one RPC call: anonymous, source `rpc`. */
function rpcCms(config: SanitizedConfig, env: Record<string, unknown>, ctx: ExecutionContext): Cms {
	return createLocalApi({
		config,
		db: dbFor(config, env),
		storage: storageFor(config, env),
		user: null,
		source: 'rpc',
		waitUntil: (p) => ctx.waitUntil(p),
	});
}

const FIND_KEYS = ['where', 'sort', 'limit', 'page', 'depth', 'pagination', 'as'] as const;

/** Builds the `KitcmsRPC` entrypoint class for a config. */
export function createKitcmsRPC(config: Config) {
	let sanitized: SanitizedConfig | undefined;
	const getConfig = () => (sanitized ??= sanitizeConfig(config));

	return class KitcmsRPC extends WorkerEntrypoint<Record<string, unknown>> implements KitcmsRPCMethods {
		async find(collection: string, options?: RpcFindOptions) {
			try {
				const { system, args } = readRpcOptions(options, FIND_KEYS);
				return await rpcCms(getConfig(), this.env, this.ctx).find(requireString(collection, 'collection'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		async findOne(collection: string, options?: Omit<RpcFindOptions, 'limit' | 'page' | 'pagination'>) {
			try {
				const { system, args } = readRpcOptions(options, ['where', 'sort', 'depth', 'as']);
				return await rpcCms(getConfig(), this.env, this.ctx).findOne(requireString(collection, 'collection'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		async findByID(collection: string, id: string, options?: RpcReadOptions) {
			try {
				const { system, args } = readRpcOptions(options, ['depth', 'as']);
				return await rpcCms(getConfig(), this.env, this.ctx).findByID(requireString(collection, 'collection'), requireString(id, 'id'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		async count(collection: string, options?: RpcCountOptions) {
			try {
				const { system, args } = readRpcOptions(options, ['where', 'as']);
				return await rpcCms(getConfig(), this.env, this.ctx).count(requireString(collection, 'collection'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		/** The public URL of an R2 object key, or `null` when uploads aren't configured. */
		async getMediaUrl(key: string) {
			try {
				const storage = storageFor(getConfig(), this.env);
				return storage ? storage.url(requireString(key, 'key')) : null;
			} catch (err) {
				rethrow(err);
			}
		}
	};
}
