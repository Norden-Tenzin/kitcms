// Multi-tenancy options (plan §15.2, Decision 29). SECURITY-CRITICAL: enforced by the access
// engine (../access/tenancy.ts). Set by `@kitcms/plugin-multi-tenant`; you normally don't write
// `tenancy` yourself.

import type { RequestEvent } from '@sveltejs/kit';
import type { Cms } from '../api/types';
import type { KitcmsUser } from './hooks';

type MaybePromise<T> = T | Promise<T>;

export interface TenancyOptions {
	/** Slugs of the tenant-scoped collections. Each has `field` (a required relationship to `tenantsCollection`). */
	collections: readonly string[];
	/** Name of the tenant field on scoped collections. */
	field: string;
	/** Slug of the collection whose documents are the tenants. */
	tenantsCollection: string;
	/** hasMany relationship on the auth collection: the tenants a user belongs to. */
	userField: string;
	/**
	 * The tenant of a request without a signed-in user (the public site, the login page,
	 * anonymous REST), e.g. from the host name. `cms` acts as system (`overrideAccess`) and has no
	 * tenant. Return `null` when the request has no tenant (scoped collections are then denied).
	 */
	resolveTenant?: (args: { event: RequestEvent; cms: Cms }) => MaybePromise<string | null>;
	/** The tenants a signed-in user may act on. `'all'` = every tenant, and no tenant (all at once). */
	userTenants: (args: { user: KitcmsUser }) => 'all' | readonly string[];
	/** R2 key prefix for uploads of a tenant, e.g. `t => \`tenants/${t}/\``. `[A-Za-z0-9/_-]`, ending in `/`. */
	storagePrefix?: (tenant: string) => string;
}

/** The admin's tenant selection cookie (plan §15.3). Re-validated on every request. */
export const TENANT_COOKIE = 'kitcms-tenant';
