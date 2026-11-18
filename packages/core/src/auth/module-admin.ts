// The auth operations the admin actions need, as result values instead of exceptions.
// Lazy-loaded by ../sveltekit/admin.ts (public routes never load Better Auth).
import { adminAccess } from '../access/engine';
import { FORM } from '../admin/types';
import type { KitcmsUser } from '../config/hooks';
import { ForbiddenError, isKitcmsError, ValidationError } from '../errors';
import type { KitcmsInternals } from '../sveltekit/index';
import { decideAdminAccess as decide, type GuardDecision } from './guard';
import {
	authContext,
	countUsers,
	createFirstAdmin as createFirst,
	createUserWithPassword as createUser,
	FirstUserError,
	setPassword as setPw,
	signIn as signInRaw,
	SignInError,
	signOut,
} from './users';

export { countUsers, signOut };

export type Result = { ok: true } | { ok: false; status: number; message: string };

export function decideAdminAccess(input: {
	view: string;
	signedIn: boolean;
	canUseAdmin: boolean;
	userCount: number;
}): GuardDecision {
	return decide({
		view: input.view,
		user: input.signedIn ? {} : null,
		canUseAdmin: input.canUseAdmin,
		userCount: input.userCount,
	});
}

/**
 * Signs in for the admin. A user without admin access (`access.admin` / role) is refused and the
 * session just created for them is revoked, so a non-admin account never holds an admin session.
 */
export async function signIn(
	k: KitcmsInternals,
	input: { email: string; password: string; headers: Headers },
): Promise<Result> {
	let user: KitcmsUser;
	try {
		user = await signInRaw(k, input);
	} catch (err) {
		if (err instanceof SignInError) {
			return { ok: false, status: err.code === 'RATE_LIMITED' ? 429 : 400, message: err.message };
		}
		throw err;
	}
	const allowed = await adminAccess(k.config, { user, context: {}, cms: k.cms, source: 'admin' });
	if (!allowed) {
		const ctx = await authContext(k);
		for (const s of await ctx.internalAdapter.listSessions(user.id)) {
			await ctx.internalAdapter.deleteSession(s.token);
		}
		return { ok: false, status: 403, message: 'This account does not have access to the admin.' };
	}
	return { ok: true };
}

export async function createFirstAdmin(
	k: KitcmsInternals,
	input: { name: string; email: string; password: string },
): Promise<Result> {
	try {
		await createFirst(k, input);
		return { ok: true };
	} catch (err) {
		if (err instanceof FirstUserError) {
			return { ok: false, status: err.code === 'INVALID' ? 400 : 403, message: err.message };
		}
		throw err;
	}
}

/** Creates a user with a password (admin "create" view of the auth collection). Throws pipeline errors. */
export async function createUserWithPassword(
	k: KitcmsInternals,
	data: Record<string, unknown> & { password: string },
): Promise<{ id: string }> {
	try {
		return await createUser(k, {
			...data,
			email: String(data.email ?? ''),
			name: String(data.name ?? ''),
		});
	} catch (err) {
		// The password input is named FORM.password in the admin form.
		if (err instanceof ValidationError) {
			throw new ValidationError(
				err.errors.map((e) => (e.path === 'password' ? { ...e, path: FORM.password } : e)),
				err.message,
			);
		}
		throw err;
	}
}

export async function setPassword(
	k: KitcmsInternals,
	input: { userId: string; newPassword: string; currentPassword?: string; headers: Headers },
): Promise<Result> {
	try {
		await setPw(k, input);
		return { ok: true };
	} catch (err) {
		if (err instanceof ValidationError) return { ok: false, status: 400, message: err.errors[0]?.message ?? err.message };
		if (err instanceof ForbiddenError || isKitcmsError(err)) {
			return { ok: false, status: (err as ForbiddenError).status, message: (err as Error).message };
		}
		throw err;
	}
}
