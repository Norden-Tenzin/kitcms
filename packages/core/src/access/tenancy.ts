// Tenant scoping (plan §15.2, Decision 29). SECURITY-CRITICAL: changes need Opus review and tests
// (the isolation suite in ../api/tenancy.test.ts and ../rpc/tenancy.test.ts).
//
// `collectionAccess` ANDs `tenantScope` into every decision BEFORE the collection's own rule runs,
// so no rule (default, custom, or missing) can widen it. Unlike collection rules, the scope also
// applies to `overrideAccess` calls that carry a tenant: trusted code acting "for tenant X" must
// never touch tenant Y's documents by accident. Trusted code WITHOUT a tenant (seed, system RPC
// without `{ tenant }`) is unscoped.
//
// Fail closed: a `userTenants` result that isn't `'all'` or an array of non-empty strings counts
// as no tenants; a scoped collection without a request tenant is denied to everyone but trusted
// code and `'all'` users.

import type { KitcmsReq, KitcmsUser, Operation } from '../config/hooks';
import type { SanitizedCollection, SanitizedTenancy } from '../config/sanitized';
import type { WhereInput } from '../config/where';

export type ScopeDecision = boolean | WhereInput;

/** The tenants `user` may act on, normalized. Anything unexpected → none. */
export function userTenantsOf(t: SanitizedTenancy, user: KitcmsUser): 'all' | readonly string[] {
	const result: unknown = t.userTenants({ user });
	if (result === 'all') return 'all';
	if (!Array.isArray(result)) return [];
	return result.filter((x): x is string => typeof x === 'string' && x !== '');
}

/** May `user` act on `tenant`? */
export function mayActOn(t: SanitizedTenancy, user: KitcmsUser, tenant: string): boolean {
	const tenants = userTenantsOf(t, user);
	return tenants === 'all' || tenants.includes(tenant);
}

/**
 * The scope ANDed into a collection access decision. `true` = unscoped, `false` = denied, a
 * `where` = only matching documents. For `create` it is always a boolean.
 */
export function tenantScope(
	collection: SanitizedCollection,
	operation: Operation,
	req: KitcmsReq,
	overrideAccess: boolean | undefined,
): ScopeDecision {
	const ct = collection.tenancy;
	if (!ct) return true;
	const t = ct.config;
	const user = req.user;
	const tenant = req.tenant;
	if (tenant !== null && (typeof tenant !== 'string' || tenant === '')) return false;

	if (ct.role === 'scoped') {
		if (tenant !== null) {
			if (!overrideAccess && user !== null && !mayActOn(t, user, tenant)) return false;
			return operation === 'create' ? true : { [t.field]: { equals: tenant } };
		}
		if (overrideAccess) return true;
		return user !== null && userTenantsOf(t, user) === 'all';
	}

	// The tenants and auth collections: only signed-in, non-'all' users are narrowed. Anonymous
	// callers are left to the collection's own rule (e.g. public tenant info), and trusted code and
	// 'all' users see everything.
	if (overrideAccess || user === null) return true;
	const tenants = userTenantsOf(t, user);
	if (tenants === 'all') return true;

	if (ct.role === 'tenants') {
		if (operation === 'create' || operation === 'delete') return false;
		// No tenants → an empty result (not a 403), so the admin's tenant switcher still loads.
		return { id: { in: [...tenants] } };
	}

	// auth collection
	const self: WhereInput = { id: { equals: user.id } };
	if (operation === 'create') return true;
	if (operation === 'read' && tenant !== null && tenants.includes(tenant)) {
		return { or: [self, { [t.userField]: { contains: tenant } }] };
	}
	return self;
}

/** `a AND b` for access decisions (`false` must be handled first). */
export function andDecisions(a: Exclude<ScopeDecision, false>, b: Exclude<ScopeDecision, false>): Exclude<ScopeDecision, false> {
	if (a === true) return b;
	if (b === true) return a;
	return { and: [a, b] };
}

/**
 * Forces the tenant field of a scoped collection's write data to the request tenant (mutates
 * `data`). Called before validation and again after `beforeChange` hooks, so neither the caller
 * nor a hook can move a document to another tenant. With no request tenant (trusted code or an
 * `'all'` user; anyone else was denied by the scope), the given value is kept.
 */
export function forceTenant(collection: SanitizedCollection, data: Record<string, unknown>, req: KitcmsReq): void {
	const ct = collection.tenancy;
	if (!ct || ct.role !== 'scoped' || req.tenant === null) return;
	data[ct.config.field] = req.tenant;
}

/** The tenant a document belongs to for reference checks: its field, or the request's. */
export function documentTenant(
	collection: SanitizedCollection,
	data: Record<string, unknown>,
	req: KitcmsReq,
): string | null {
	const ct = collection.tenancy;
	if (ct?.role === 'scoped') {
		const v = data[ct.config.field];
		return typeof v === 'string' && v !== '' ? v : null;
	}
	return req.tenant;
}

const PREFIX = /^[A-Za-z0-9_-][A-Za-z0-9/_-]*\/$/;

/** The R2 key prefix for a tenant's uploads. Throws on an unsafe prefix. */
export function storagePrefixFor(t: SanitizedTenancy | false, tenant: string | null): string {
	if (!t || !t.storagePrefix || tenant === null) return '';
	const prefix: unknown = t.storagePrefix(tenant);
	if (typeof prefix !== 'string' || !PREFIX.test(prefix) || prefix.includes('//') || prefix.split('/').includes('..')) {
		throw new Error(`kitcms: tenancy.storagePrefix returned an unsafe prefix ${JSON.stringify(prefix)} (use [A-Za-z0-9/_-], ending in "/").`);
	}
	return prefix;
}

/**
 * The tenant of a request (§15.2).
 * - No user: `hostTenant` (from `resolveTenant`).
 * - Signed in: the selection cookie if the user may act on it (`''` = all, `'all'` users only),
 *   else the host tenant if the user may act on it, else the user's first tenant (`'all'` users:
 *   `null`, every tenant).
 */
export function requestTenant(
	t: SanitizedTenancy,
	user: KitcmsUser | null,
	hostTenant: string | null,
	cookie: string | null,
): string | null {
	if (user === null) return hostTenant;
	const tenants = userTenantsOf(t, user);
	if (cookie !== null) {
		if (cookie === '' && tenants === 'all') return null;
		if (cookie !== '' && (tenants === 'all' || tenants.includes(cookie))) return cookie;
	}
	if (hostTenant !== null && (tenants === 'all' || tenants.includes(hostTenant))) return hostTenant;
	return tenants === 'all' ? null : (tenants[0] ?? null);
}
