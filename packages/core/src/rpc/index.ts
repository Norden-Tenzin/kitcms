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
// - Reads (find, findOne, findByID, count, findGlobal, getMediaUrl) are open to anonymous callers.
//   `draft: true` on a read requires `as: 'system'` (an anonymous caller never sees drafts).
// - WRITES (create, update, delete, move, unpublish, updateGlobal; plan §13.8) require
//   `{ as: 'system' }`: anything else is FORBIDDEN before any work is done. They run with
//   `overrideAccess: true`; hooks and validation still run.
// - Options from the caller are untrusted structured-clone data: only whitelisted keys are
//   copied, with type checks. `overrideAccess`, `req`, `context` or anything else the caller sends
//   is never passed to the Local API.
// - Errors cross the boundary as `Error` with the message `kitcms:<CODE>:<status>: <message>`
//   (custom error properties don't survive RPC); `@kitcms/client` turns them back into typed errors.
// - `{ tenant }` (multi-tenant plugin, §15.2): every call may name the tenant it acts on. Reads and
//   writes on tenant-scoped collections are then limited to that tenant, also for `as: 'system'`
//   (the scope applies to trusted calls that carry a tenant). Anonymous calls on scoped collections
//   WITHOUT a tenant are FORBIDDEN; system calls without one are unscoped. Rejected (QueryError)
//   when the config has no tenancy.

import { WorkerEntrypoint } from 'cloudflare:workers';
import { createLocalApi } from '../api/local';
import type { Cms } from '../api/types';
import type { Config } from '../config/collection';
import { sanitizeConfig } from '../config/sanitize';
import type { SanitizedConfig } from '../config/sanitized';
import type { WhereInput } from '../config/where';
import { ForbiddenError, isKitcmsError, QueryError } from '../errors';
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
	/** Multi-tenancy (§15.2): the tenant to act on. */
	tenant?: string;
}
export interface RpcReadOptions {
	depth?: number;
	as?: 'system';
	tenant?: string;
}
export interface RpcCountOptions {
	where?: WhereInput;
	as?: 'system';
	tenant?: string;
}
/** Reads may ask for drafts only as `system`. */
export interface RpcDraftReadOptions {
	/** Requires `as: 'system'`. */
	draft?: boolean;
}
/** Options of every write. `as: 'system'` is required. */
export interface RpcWriteOptions {
	as: 'system';
	tenant?: string;
	depth?: number;
	/** Save as a draft (collections/globals with drafts). */
	draft?: boolean;
}
/** Options of `delete`, `move`, `unpublish`. */
export interface RpcSystemOptions {
	as: 'system';
	tenant?: string;
}
export type RpcMoveTarget = { before: string } | { after: string };

/** The RPC surface, as seen by `@kitcms/client`. */
export interface KitcmsRPCMethods {
	find(collection: string, options?: RpcFindOptions & RpcDraftReadOptions): Promise<unknown>;
	findOne(
		collection: string,
		options?: Omit<RpcFindOptions, 'limit' | 'page' | 'pagination'> & RpcDraftReadOptions,
	): Promise<unknown>;
	findByID(collection: string, id: string, options?: RpcReadOptions & RpcDraftReadOptions): Promise<unknown>;
	count(collection: string, options?: RpcCountOptions): Promise<number>;
	findGlobal(global: string, options?: RpcReadOptions & RpcDraftReadOptions): Promise<unknown>;
	getMediaUrl(key: string): Promise<string | null>;
	create(collection: string, data: Record<string, unknown>, options: RpcWriteOptions): Promise<unknown>;
	update(collection: string, id: string, data: Record<string, unknown>, options: RpcWriteOptions): Promise<unknown>;
	delete(collection: string, id: string, options: RpcSystemOptions): Promise<unknown>;
	move(collection: string, id: string, target: RpcMoveTarget, options: RpcSystemOptions): Promise<unknown>;
	unpublish(collection: string, id: string, options: RpcSystemOptions): Promise<unknown>;
	updateGlobal(global: string, data: Record<string, unknown>, options: RpcWriteOptions): Promise<unknown>;
}

type OptionKey = 'where' | 'sort' | 'limit' | 'page' | 'depth' | 'pagination' | 'as' | 'draft' | 'tenant';
const TENANT_ID = /^[A-Za-z0-9_-]{1,128}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** @internal Whitelists caller options. Unknown keys are rejected loudly (a typo shouldn't silently widen nothing). */
export function readRpcOptions(
	raw: unknown,
	allowed: readonly OptionKey[],
): { system: boolean; tenant: string | null; args: Record<string, unknown> } {
	if (raw === undefined || raw === null) return { system: false, tenant: null, args: {} };
	if (!isPlainObject(raw)) throw new QueryError('options must be an object.');
	const args: Record<string, unknown> = {};
	let system = false;
	let tenant: string | null = null;
	for (const [key, value] of Object.entries(raw)) {
		if (value === undefined) continue;
		if (!(allowed as readonly string[]).includes(key)) throw new QueryError(`Unknown option "${key}".`);
		switch (key) {
			case 'as':
				if (value !== 'system') throw new QueryError('`as` must be "system".');
				system = true;
				break;
			case 'tenant':
				if (typeof value !== 'string' || !TENANT_ID.test(value)) throw new QueryError('`tenant` must be a tenant id.');
				tenant = value;
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
			case 'draft':
				if (typeof value !== 'boolean') throw new QueryError(`\`${key}\` must be a boolean.`);
				args[key] = value;
				break;
			default: // limit, page, depth: validated by the Local API
				if (typeof value !== 'number') throw new QueryError(`\`${key}\` must be a number.`);
				args[key] = value;
		}
	}
	// Drafts are unpublished content: only trusted callers may read or write them.
	if (args.draft === true && !system) throw new ForbiddenError('`draft` needs `{ as: "system" }`.');
	return { system, tenant, args };
}

/** @internal Options of a write: `as: 'system'` is mandatory (checked first, before any other validation). */
export function readRpcWriteOptions(
	raw: unknown,
	allowed: readonly OptionKey[],
): { tenant: string | null; args: Record<string, unknown> } {
	const as = isPlainObject(raw) ? raw.as : undefined;
	if (as !== 'system') throw new ForbiddenError('RPC writes need `{ as: "system" }`.');
	const { tenant, args } = readRpcOptions(raw, allowed);
	return { tenant, args };
}

function readData(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new QueryError('`data` must be an object.');
	return value;
}

function readMoveTarget(value: unknown): { before: string } | { after: string } {
	if (!isPlainObject(value)) throw new QueryError('`target` must be `{ before: id }` or `{ after: id }`.');
	const keys = Object.keys(value).filter((k) => value[k] !== undefined);
	if (keys.length === 1 && (keys[0] === 'before' || keys[0] === 'after')) {
		const id = requireString(value[keys[0]], keys[0]);
		return keys[0] === 'before' ? { before: id } : { after: id };
	}
	throw new QueryError('`target` must be `{ before: id }` or `{ after: id }`.');
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
function rpcCms(
	config: SanitizedConfig,
	env: Record<string, unknown>,
	ctx: ExecutionContext,
	system: boolean,
	tenant: string | null,
): Cms {
	if (tenant !== null && !config.tenancy) throw new QueryError('`tenant` needs the multi-tenant plugin.');
	return createLocalApi({
		config,
		// Trusted `system` calls read the primary (fresh after their own writes); anonymous reads any replica.
		db: dbFor(config, env, system ? 'first-primary' : 'first-unconstrained'),
		storage: storageFor(config, env),
		user: null,
		source: 'rpc',
		waitUntil: (p) => ctx.waitUntil(p),
		tenant,
	});
}

const FIND_KEYS = ['where', 'sort', 'limit', 'page', 'depth', 'pagination', 'as', 'draft', 'tenant'] as const;
const WRITE_KEYS = ['as', 'depth', 'draft', 'tenant'] as const;
const SYSTEM_KEYS = ['as', 'tenant'] as const;

/** Builds the `KitcmsRPC` entrypoint class for a config. */
export function createKitcmsRPC(config: Config) {
	let sanitized: SanitizedConfig | undefined;
	const getConfig = () => (sanitized ??= sanitizeConfig(config));

	return class KitcmsRPC extends WorkerEntrypoint<Record<string, unknown>> implements KitcmsRPCMethods {
		async find(collection: string, options?: RpcFindOptions & RpcDraftReadOptions) {
			try {
				const { system, tenant, args } = readRpcOptions(options, FIND_KEYS);
				return await rpcCms(getConfig(), this.env, this.ctx, system, tenant).find(requireString(collection, 'collection'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		async findOne(collection: string, options?: Omit<RpcFindOptions, 'limit' | 'page' | 'pagination'> & RpcDraftReadOptions) {
			try {
				const { system, tenant, args } = readRpcOptions(options, ['where', 'sort', 'depth', 'as', 'draft', 'tenant']);
				return await rpcCms(getConfig(), this.env, this.ctx, system, tenant).findOne(requireString(collection, 'collection'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		async findByID(collection: string, id: string, options?: RpcReadOptions & RpcDraftReadOptions) {
			try {
				const { system, tenant, args } = readRpcOptions(options, ['depth', 'as', 'draft', 'tenant']);
				return await rpcCms(getConfig(), this.env, this.ctx, system, tenant).findByID(requireString(collection, 'collection'), requireString(id, 'id'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		async count(collection: string, options?: RpcCountOptions) {
			try {
				const { system, tenant, args } = readRpcOptions(options, ['where', 'as', 'tenant']);
				return await rpcCms(getConfig(), this.env, this.ctx, system, tenant).count(requireString(collection, 'collection'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		async findGlobal(global: string, options?: RpcReadOptions & RpcDraftReadOptions) {
			try {
				const { system, tenant, args } = readRpcOptions(options, ['depth', 'as', 'draft', 'tenant']);
				return await rpcCms(getConfig(), this.env, this.ctx, system, tenant).findGlobal(requireString(global, 'global'), {
					...args,
					overrideAccess: system,
				} as never);
			} catch (err) {
				rethrow(err);
			}
		}

		// ----- writes: `as: 'system'` only (§13.8) ------------------------------------------------

		async create(collection: string, data: Record<string, unknown>, options: RpcWriteOptions) {
			try {
				const { tenant, args } = readRpcWriteOptions(options, WRITE_KEYS);
				return await rpcCms(getConfig(), this.env, this.ctx, true, tenant).create(
					requireString(collection, 'collection'),
					readData(data),
					{ ...args, overrideAccess: true } as never,
				);
			} catch (err) {
				rethrow(err);
			}
		}

		async update(collection: string, id: string, data: Record<string, unknown>, options: RpcWriteOptions) {
			try {
				const { tenant, args } = readRpcWriteOptions(options, WRITE_KEYS);
				return await rpcCms(getConfig(), this.env, this.ctx, true, tenant).update(
					requireString(collection, 'collection'),
					requireString(id, 'id'),
					readData(data),
					{ ...args, overrideAccess: true } as never,
				);
			} catch (err) {
				rethrow(err);
			}
		}

		async delete(collection: string, id: string, options: RpcSystemOptions) {
			try {
				const { tenant } = readRpcWriteOptions(options, SYSTEM_KEYS);
				return await rpcCms(getConfig(), this.env, this.ctx, true, tenant).delete(
					requireString(collection, 'collection'),
					requireString(id, 'id'),
					{ overrideAccess: true },
				);
			} catch (err) {
				rethrow(err);
			}
		}

		async move(collection: string, id: string, target: RpcMoveTarget, options: RpcSystemOptions) {
			try {
				const { tenant } = readRpcWriteOptions(options, SYSTEM_KEYS);
				return await rpcCms(getConfig(), this.env, this.ctx, true, tenant).move(
					requireString(collection, 'collection'),
					requireString(id, 'id'),
					readMoveTarget(target),
					{ overrideAccess: true },
				);
			} catch (err) {
				rethrow(err);
			}
		}

		async unpublish(collection: string, id: string, options: RpcSystemOptions) {
			try {
				const { tenant } = readRpcWriteOptions(options, SYSTEM_KEYS);
				return await rpcCms(getConfig(), this.env, this.ctx, true, tenant).unpublish(
					requireString(collection, 'collection'),
					requireString(id, 'id'),
					{ overrideAccess: true },
				);
			} catch (err) {
				rethrow(err);
			}
		}

		async updateGlobal(global: string, data: Record<string, unknown>, options: RpcWriteOptions) {
			try {
				const { tenant, args } = readRpcWriteOptions(options, WRITE_KEYS);
				return await rpcCms(getConfig(), this.env, this.ctx, true, tenant).updateGlobal(
					requireString(global, 'global'),
					readData(data),
					{ ...args, overrideAccess: true } as never,
				);
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
