// SPIKE (Phase 0): admin `load` + `actions` shipped by the package and re-exported by a
// generated route file `src/routes/(kitcms)/admin/[...path]/+page.server.ts`.
// The admin has an internal router over `params.path`, so upgrades never need new route files.
import { resolve } from '$app/paths';
import { error, fail, redirect, type Actions, type RequestEvent, type ServerLoadEvent } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { countUsers, createFirstAdmin, FirstUserError, getAuth } from './auth';
import { decideAdminAccess, isRole, isSameOrigin } from './auth-guard';
import type { Doc, KitcmsCollectionMeta } from './index';

export type AdminRoute =
	| { view: 'login' }
	| { view: 'create-first-user' }
	| { view: 'dashboard' }
	| { view: 'list'; collection: string }
	| { view: 'edit'; collection: string; id: string };

export function matchAdminRoute(path: string): AdminRoute | null {
	const parts = path.split('/').filter(Boolean);
	if (parts.length === 0) return { view: 'dashboard' };
	if (parts.length === 1 && parts[0] === 'login') return { view: 'login' };
	if (parts.length === 1 && parts[0] === 'create-first-user') return { view: 'create-first-user' };
	if (parts[0] !== 'collections' || !parts[1]) return null;
	if (parts.length === 2) return { view: 'list', collection: parts[1] };
	if (parts.length === 3 && parts[2]) return { view: 'edit', collection: parts[1], id: parts[2] };
	return null;
}

/** What the admin `load` returns. The single type shared by core (producer) and @kitcms/ui (consumer). */
export interface AdminData {
	route: AdminRoute;
	/** The signed-in user (never carries credentials). Absent on the login / first-user views. */
	user?: { id: string; email: string; name: string; role: string };
	collections: KitcmsCollectionMeta[];
	meta?: KitcmsCollectionMeta;
	docs?: Doc[];
	doc?: Doc;
}

/** What the `save` action returns on success (failures use `fail(400, AdminActionFailure)`). */
export interface AdminActionResult {
	saved: true;
	doc: Doc;
}
export interface AdminActionFailure {
	field: string;
	message: string;
}

const ADMIN = '/(kitcms)/admin/[...path]';
const adminUrl = (path: string) => resolve(ADMIN, { path });

/** Smallest blocking guard shared by the load and the actions. Returns the user, or throws a redirect / error. */
async function requireUser(event: Pick<RequestEvent, 'locals'>, view: string) {
	const { user } = event.locals;
	const decision = decideAdminAccess({
		view,
		user,
		// A signed-in user implies at least one user: only query when signed out.
		userCount: user ? 1 : await countUsers(),
	});
	if (decision.kind === 'redirect') {
		redirect(303, adminUrl(decision.to === 'dashboard' ? '' : decision.to));
	}
	if (decision.kind === 'deny') error(403, 'Forbidden');
	return user;
}

// Explicit param/return types (not `ServerLoad`): SvelteKit infers the generated route's
// `PageData` from the re-exported `load`'s return type.
export const load = async (event: ServerLoadEvent): Promise<AdminData> => {
	const { params, locals } = event;
	const route = matchAdminRoute(params.path ?? '');
	if (!route) error(404, 'Not found');
	const user = await requireUser(event, route.view);
	if (route.view === 'login' || route.view === 'create-first-user') {
		return { route, collections: [] };
	}
	if (!user) error(401, 'Unauthorized'); // unreachable: requireUser redirects or denies
	const { cms } = locals;
	const collections = cms.collections;
	const me = { id: user.id, email: user.email, name: user.name, role: user.role };

	if (route.view === 'dashboard') return { route, collections, user: me };

	const meta = collections.find((c) => c.slug === route.collection);
	if (!meta) error(404, `Unknown collection "${route.collection}"`);

	if (route.view === 'list') {
		const { docs } = await cms.find(meta.slug, { limit: 50 });
		return { route, collections, meta, docs, user: me };
	}
	const doc = await cms.findByID(meta.slug, route.id);
	if (!doc) error(404, 'Document not found');
	return { route, collections, meta, doc, user: me };
};

export interface AdminAuthFailure {
	message: string;
}

const failAuth = (status: number, message: string) => fail(status, { message } satisfies AdminAuthFailure);

function str(form: FormData, key: string): string {
	const v = form.get(key);
	return typeof v === 'string' ? v : '';
}

export const actions: Actions = {
	login: async ({ request, url }) => {
		if (!isSameOrigin(request, url)) error(403, 'Cross-origin request blocked');
		const form = await request.formData();
		try {
			// Set-Cookie is copied onto the response by Better Auth's sveltekitCookies plugin.
			await getAuth().api.signInEmail({
				body: { email: str(form, 'email'), password: str(form, 'password') },
				headers: request.headers,
			});
		} catch (err) {
			if (err instanceof APIError) return failAuth(400, 'Invalid email or password');
			throw err;
		}
		redirect(303, adminUrl(''));
	},

	logout: async ({ request, url }) => {
		if (!isSameOrigin(request, url)) error(403, 'Cross-origin request blocked');
		try {
			await getAuth().api.signOut({ headers: request.headers });
		} catch (err) {
			if (!(err instanceof APIError)) throw err;
		}
		redirect(303, adminUrl('login'));
	},

	createFirstUser: async ({ request, url }) => {
		if (!isSameOrigin(request, url)) error(403, 'Cross-origin request blocked');
		const form = await request.formData();
		const email = str(form, 'email').trim().toLowerCase();
		const password = str(form, 'password');
		try {
			// Re-checks "zero users" itself; a client-supplied `role` is never read.
			await createFirstAdmin({ name: str(form, 'name'), email, password });
		} catch (err) {
			if (err instanceof FirstUserError) {
				return failAuth(err.code === 'INVALID' ? 400 : 403, err.message);
			}
			throw err;
		}
		try {
			await getAuth().api.signInEmail({ body: { email, password }, headers: request.headers });
		} catch (err) {
			if (!(err instanceof APIError)) throw err;
			redirect(303, adminUrl('login'));
		}
		redirect(303, adminUrl(''));
	},

	save: async (event) => {
		const { params, locals, request, url } = event;
		if (!isSameOrigin(request, url)) error(403, 'Cross-origin request blocked');
		const user = locals.user;
		if (!user) error(401, 'Unauthorized');
		if (!isRole(user.role)) error(403, 'Forbidden');
		const route = matchAdminRoute(params.path ?? '');
		if (route?.view !== 'edit') error(404, 'Not found');
		const meta = locals.cms.collections.find((c) => c.slug === route.collection);
		if (!meta) error(404, 'Unknown collection');

		const form = await request.formData();
		const data: Record<string, unknown> = {};
		for (const field of meta.editable) {
			const value = form.get(field);
			if (typeof value !== 'string') continue;
			if (value.trim() === '')
				return fail(400, { field, message: `${field} is required` } satisfies AdminActionFailure);
			data[field] = value;
		}
		const doc = await locals.cms.update(meta.slug, route.id, data);
		return { saved: true, doc } satisfies AdminActionResult;
	},
};
