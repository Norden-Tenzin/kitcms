// Mapping Better Auth rows to kitcms's public user/session shapes (no credentials, no token).
import type { KitcmsUser } from '../config/hooks';

/** The current session. Deliberately has no token: the cookie is the only place it is visible. */
export interface AuthSession {
	id: string;
	expiresAt: Date;
}

/** A Better Auth `user` row (or API result) -> `KitcmsUser`. Only these fields ever leave the auth module. */
export function toKitcmsUser(row: Record<string, unknown>, authCollection: string): KitcmsUser {
	return {
		id: String(row.id),
		email: String(row.email ?? ''),
		name: String(row.name ?? ''),
		role: typeof row.role === 'string' ? row.role : '',
		collection: authCollection,
	};
}

/** A Better Auth `session` row -> `AuthSession`. Drops the token, IP and user agent. */
export function toAuthSession(row: Record<string, unknown>): AuthSession {
	const expires = row.expiresAt;
	return {
		id: String(row.id),
		expiresAt: expires instanceof Date ? expires : new Date(expires as string | number),
	};
}
