// @kitcms/plugin-multi-tenant (plan §8, §15.2). The plugin is a config transform: it adds the
// tenant fields and per-tenant unique indexes, and fills `config.tenancy`. ENFORCEMENT lives in
// @kitcms/core (access engine + pipeline), so it applies to the Local API, RPC, REST and the admin
// alike and can't be bypassed by a collection's own access rules.
//
//   multiTenant({
//     tenantsCollection: 'vendors',
//     collections: ['pages', 'rooms', 'media'],
//     resolveTenant: tenantByHost({ domainField: 'customDomain', subdomain: { field: 'slug', rootDomain: 'dzongla.com' } }),
//   })

import { fields as f } from '@kitcms/core';
import type { Cms, Config, KitcmsPlugin, KitcmsUser, TenancyOptions } from '@kitcms/core';
import type { RequestEvent } from '@sveltejs/kit';

type MaybePromise<T> = T | Promise<T>;
type Raw = Record<string, unknown>;

export interface MultiTenantOptions {
	/** Slug of the collection whose documents are the tenants (e.g. `vendors`). */
	tenantsCollection: string;
	/** Collections scoped by tenant. Each gets the tenant field (unless it defines it). */
	collections: string[];
	/** Tenant field name on scoped collections. Default `'tenant'`. */
	field?: string;
	/** hasMany field on the auth collection listing a user's tenants. Default `'tenants'`. */
	userField?: string;
	/**
	 * The tenant of a request without a signed-in user (the public site), usually from the host:
	 * see `tenantByHost`. `cms` acts as system. Return `null` for "no tenant" (scoped collections
	 * are then denied). Results are cached per host for `cacheTtl` seconds.
	 */
	resolveTenant?: (args: { event: RequestEvent; cms: Cms }) => MaybePromise<string | null>;
	/** Which tenants a signed-in user may act on. Default: role `admin` → `'all'`, else `user.tenants`. */
	userTenants?: (args: { user: KitcmsUser }) => 'all' | readonly string[];
	/** R2 key prefix per tenant. Default `tenants/<id>/`. `false` = no prefix. */
	storagePrefix?: false | ((tenant: string) => string);
	/** Seconds a host → tenant result is cached in the isolate. Default 60. `0` = no cache. */
	cacheTtl?: number;
}

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

function fail(message: string): never {
	throw new Error(`multiTenant: ${message}`);
}

function isObject(v: unknown): v is Raw {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Default: admins act on every tenant, everyone else on the tenants listed on their user. */
export function defaultUserTenants({ user }: { user: KitcmsUser }): 'all' | readonly string[] {
	return user.role === 'admin' ? 'all' : (user.tenants ?? []);
}

/**
 * Moves `unique` off top-level column fields (recursing through row/collapsible/tabs, which are
 * layout only) and returns their names, so they can become `(tenant, field)` unique indexes.
 */
function takeUnique(fields: Raw, out: string[]): Raw {
	const next: Raw = {};
	for (const [name, def] of Object.entries(fields)) {
		if (!isObject(def)) {
			next[name] = def;
			continue;
		}
		if (def['~layout'] === true) {
			if (isObject(def.fields)) next[name] = { ...def, fields: takeUnique(def.fields, out) };
			else if (Array.isArray(def.tabs)) {
				next[name] = {
					...def,
					tabs: def.tabs.map((t: unknown) => (isObject(t) && isObject(t.fields) ? { ...t, fields: takeUnique(t.fields, out) } : t)),
				};
			} else next[name] = def;
			continue;
		}
		if (def.unique === true) {
			out.push(name);
			next[name] = { ...def, unique: false };
		} else next[name] = def;
	}
	return next;
}

/** A per-isolate TTL cache in front of `resolveTenant`, keyed by host. */
function cached(
	resolve: NonNullable<MultiTenantOptions['resolveTenant']>,
	ttl: number,
): NonNullable<TenancyOptions['resolveTenant']> {
	if (ttl <= 0) return resolve;
	const entries = new Map<string, { value: string | null; expires: number }>();
	const MAX = 1000;
	return async (args) => {
		const key = args.event.url.host.toLowerCase();
		const now = Date.now();
		const hit = entries.get(key);
		if (hit && hit.expires > now) return hit.value;
		const value = await resolve(args);
		if (entries.size >= MAX) entries.clear();
		entries.set(key, { value, expires: now + ttl * 1000 });
		return value;
	};
}

/** The multi-tenant plugin. */
export function multiTenant(options: MultiTenantOptions): KitcmsPlugin {
	const field = options.field ?? 'tenant';
	const userField = options.userField ?? 'tenants';
	const ttl = options.cacheTtl ?? 60;
	if (!isObject(options)) fail('options are required.');
	if (typeof options.tenantsCollection !== 'string' || options.tenantsCollection === '') fail('`tenantsCollection` is required.');
	if (!Array.isArray(options.collections) || options.collections.length === 0) fail('`collections` must list at least one collection.');
	if (!NAME.test(field)) fail('`field` must be a valid field name.');
	if (!NAME.test(userField)) fail('`userField` must be a valid field name.');
	if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl < 0) fail('`cacheTtl` must be a number of seconds ≥ 0.');

	const storagePrefix =
		options.storagePrefix === false ? undefined : (options.storagePrefix ?? ((t: string) => `tenants/${t}/`));

	return {
		name: 'multi-tenant',
		config(config: Config): Config {
			const tenantsSlug = options.tenantsCollection;
			const scoped = new Set(options.collections);
			const collections = config.collections as unknown as Raw[];
			const slugs = new Set(collections.map((c) => c.slug as string));
			if (!slugs.has(tenantsSlug)) fail(`tenantsCollection "${tenantsSlug}" is not a collection.`);
			for (const s of scoped) if (!slugs.has(s)) fail(`"${s}" is not a collection (globals can't be scoped).`);

			let authFound = false;
			const next: Raw[] = collections.map((c) => {
				const slug = c.slug as string;
				const fieldsIn = isObject(c.fields) ? c.fields : {};
				if (c.auth === true) {
					authFound = true;
					if (fieldsIn[userField] !== undefined) return c;
					return { ...c, fields: { ...fieldsIn, [userField]: tenantsField(tenantsSlug) } };
				}
				if (!scoped.has(slug)) return c;
				const unique: string[] = [];
				const fields = takeUnique(fieldsIn, unique);
				if (fields[field] === undefined) {
					fields[field] = f.relationship({
						relationTo: tenantsSlug,
						required: true,
						admin: { position: 'sidebar', description: 'Set automatically from the selected tenant.' },
					});
				}
				const indexes = [
					...(Array.isArray(c.indexes) ? (c.indexes as unknown[]) : []),
					...unique.map((name) => ({ fields: [field, name], unique: true })),
				];
				return { ...c, fields, indexes };
			});
			if (!authFound) {
				// Core would add a built-in `users`; add it here so it gets the tenants field.
				if (slugs.has('users')) fail('no collection has `auth: true`, and "users" is taken.');
				next.push({ slug: 'users', auth: true, fields: { [userField]: tenantsField(tenantsSlug) } });
			}

			const tenancy: TenancyOptions = {
				collections: [...scoped],
				field,
				tenantsCollection: tenantsSlug,
				userField,
				userTenants: options.userTenants ?? defaultUserTenants,
				...(options.resolveTenant ? { resolveTenant: cached(options.resolveTenant, ttl) } : {}),
				...(storagePrefix ? { storagePrefix } : {}),
			};
			return { ...config, collections: next as never, tenancy };
		},
	};
}

function tenantsField(tenantsSlug: string) {
	return f.relationship({
		relationTo: tenantsSlug,
		hasMany: true,
		admin: { position: 'sidebar', description: 'Tenants this user can work on. Only admins can change it.' },
	});
}

export interface TenantByHostOptions {
	/** Slug of the tenants collection (same as `tenantsCollection`). */
	collection: string;
	/** A text field holding a full custom domain (`hotel.example.com`), matched case-insensitively. */
	domainField?: string;
	/** `{slug}.rootDomain` hosts: the first label is matched against `field`. */
	subdomain?: { field: string; rootDomain: string };
}

/**
 * A `resolveTenant` that looks the host up in the tenants collection (one query per host per
 * `cacheTtl`): a custom domain match, or a subdomain of `rootDomain`. The port is ignored.
 */
export function tenantByHost(options: TenantByHostOptions): NonNullable<MultiTenantOptions['resolveTenant']> {
	const root = options.subdomain?.rootDomain.toLowerCase().replace(/^\.+/, '');
	return async ({ event, cms }) => {
		const host = event.url.hostname.toLowerCase();
		const or: Raw[] = [];
		if (options.domainField) or.push({ [options.domainField]: { equals: host } });
		if (options.subdomain && root && host.endsWith(`.${root}`)) {
			const label = host.slice(0, -(root.length + 1));
			if (label && !label.includes('.')) or.push({ [options.subdomain.field]: { equals: label } });
		}
		if (or.length === 0) return null;
		const doc = (await cms.findOne(options.collection, { where: { or } as never })) as { id?: unknown } | null;
		return typeof doc?.id === 'string' ? doc.id : null;
	};
}
