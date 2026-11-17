// The admin's tenant selection cookie (plan §15.3). The value is only a REQUEST: the handle
// re-validates it against the user's tenants on every request (access/tenancy.ts `requestTenant`).
import { TENANT_COOKIE } from '../config/tenancy';

const VALUE = /^[A-Za-z0-9_-]{0,128}$/;

/** The cookie's value (`''` = "all tenants"), or `null` when absent or malformed. */
export function readTenantCookie(cookieHeader: string | null | undefined): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(';')) {
		const eq = part.indexOf('=');
		if (eq < 0 || part.slice(0, eq).trim() !== TENANT_COOKIE) continue;
		let value: string;
		try {
			value = decodeURIComponent(part.slice(eq + 1).trim());
		} catch {
			return null;
		}
		return VALUE.test(value) ? value : null;
	}
	return null;
}

/** `Set-Cookie` for the selection. `tenant: ''` selects all tenants. */
export function serializeTenantCookie(tenant: string, opts: { base: string; secure: boolean }): string {
	if (!VALUE.test(tenant)) throw new Error('kitcms: invalid tenant id.');
	const path = `${opts.base.replace(/\/+$/, '')}/`;
	return `${TENANT_COOKIE}=${tenant}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=31536000${opts.secure ? '; Secure' : ''}`;
}
