// The admin's `load` + `actions`, re-exported by the generated route file
// `src/routes/(kitcms)/admin/[...path]/+page.server.ts`. The admin has an internal router over
// `params.path`, so package upgrades never need new route files (§4.1).
//
// Security (§4.7 Phase 0 shape, §11 adjustment 4):
// - Every action checks `Origin` FIRST (missing or foreign → 403); SvelteKit's own CSRF check is
//   off in dev and only covers form content types.
// - Every protected load/action re-checks the session user and `adminAccess` itself.
// - Content operations go through the Local API acting as the signed-in user (source `admin`):
//   collection + field access, hooks and validation all apply. The admin never uses overrideAccess.

import { resolve } from '$app/paths';
import { error, fail, redirect, type Actions, type RequestEvent } from '@sveltejs/kit';
import { adminAccess, collectionAccess } from '../access/engine';
import { FORM, formString, parseFormData } from '../admin/form';
import type {
	AdminActionData,
	AdminData,
	AdminDoc,
	AdminPermissions,
	AdminRoute,
	ListQuery,
} from '../admin/types';
import type { Cms } from '../api/types';
import type { KitcmsReq, KitcmsUser } from '../config/hooks';
import type { ClientCollection, ClientConfig, SanitizedCollection, SanitizedConfig } from '../config/sanitized';
import { toClientConfig } from '../config/sanitize';
import type { WhereInput } from '../config/where';
import { isKitcmsError, ReferencedError, ValidationError } from '../errors';
import { getKitcms, type KitcmsInternals } from './index';

export type * from '../admin/types';

export function matchAdminRoute(path: string): AdminRoute | null {
	const parts = path.split('/').filter(Boolean);
	if (parts.length === 0) return { view: 'dashboard' };
	if (parts.length === 1 && parts[0] === 'login') return { view: 'login' };
	if (parts.length === 1 && parts[0] === 'create-first-user') return { view: 'create-first-user' };
	if (parts[0] !== 'collections' || !parts[1]) return null;
	if (parts.length === 2) return { view: 'list', collection: parts[1] };
	if (parts.length === 3 && parts[2] === 'create') return { view: 'create', collection: parts[1] };
	if (parts.length === 3 && parts[2]) return { view: 'edit', collection: parts[1], id: parts[2] };
	return null;
}

const ADMIN = '/(kitcms)/admin/[...path]';
const adminUrl = (path: string) => (resolve as (id: string, p: object) => string)(ADMIN, { path });

const clientConfigs = new WeakMap<SanitizedConfig, ClientConfig>();
function clientConfig(config: SanitizedConfig): ClientConfig {
	let c = clientConfigs.get(config);
	if (!c) {
		c = toClientConfig(config);
		clientConfigs.set(config, c);
	}
	return c;
}

function sysReq(k: KitcmsInternals, user: KitcmsUser | null): KitcmsReq {
	return { user, context: {}, cms: k.cms, source: 'admin' };
}

const auth = () => import('../auth/module-admin');

/**
 * The guard shared by load and actions. Returns the user and an admin-sourced Local API, or
 * throws a redirect (to login / first-user) or a 403.
 */
async function requireAdmin(
	event: Pick<RequestEvent, 'locals'>,
	view: AdminRoute['view'],
): Promise<{ k: KitcmsInternals; user: KitcmsUser | null; cms: Cms }> {
	const k = getKitcms(event.locals);
	const user = k.user;
	const { decideAdminAccess, countUsers } = await auth();
	const canUseAdmin = user ? await adminAccess(k.config, sysReq(k, user)) : false;
	const decision = decideAdminAccess({
		view,
		signedIn: user !== null,
		canUseAdmin,
		// A signed-in user implies at least one user: only query when signed out.
		userCount: user ? 1 : await countUsers(k),
	});
	if (decision.kind === 'redirect') redirect(303, adminUrl(decision.to === 'dashboard' ? '' : decision.to));
	if (decision.kind === 'deny') error(403, 'You do not have access to the admin.');
	return { k, user, cms: k.cmsFor(user, 'admin') };
}

function collectionFor(k: KitcmsInternals, slug: string): { col: SanitizedCollection; client: ClientCollection } {
	const col = k.config.collectionsBySlug[slug];
	const client = clientConfig(k.config).collections.find((c) => c.slug === slug);
	if (!col || !client) error(404, `Unknown collection "${slug}"`);
	return { col, client };
}

async function permissions(col: SanitizedCollection, req: KitcmsReq, id?: string): Promise<AdminPermissions> {
	const [create, update, del] = await Promise.all([
		collectionAccess(col, 'create', { req }),
		collectionAccess(col, 'update', { req, id }),
		collectionAccess(col, 'delete', { req, id }),
	]);
	return { create: create !== false, update: update !== false, delete: del !== false };
}

function nav(k: KitcmsInternals) {
	return k.config.collections
		.filter((c) => !c.admin.hidden)
		.map((c) => ({ slug: c.slug, label: c.labels.plural, group: c.admin.group }));
}

function me(user: KitcmsUser) {
	return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function listQuery(url: URL, col: SanitizedCollection): ListQuery {
	const int = (v: string | null, d: number) => {
		const n = Number(v);
		return Number.isInteger(n) && n > 0 ? n : d;
	};
	const limit = Math.min(int(url.searchParams.get('limit'), 25), 100);
	return {
		page: int(url.searchParams.get('page'), 1),
		limit,
		sort: url.searchParams.get('sort') || col.defaultSort,
		q: (url.searchParams.get('q') ?? '').slice(0, 200),
		view: url.searchParams.get('view') === 'table' ? 'table' : 'grid',
	};
}

/** Top-level fields hidden by `admin.condition` for this document. */
function hiddenFields(col: SanitizedCollection, doc: Record<string, unknown>): string[] {
	return col.fields.filter((f) => f.admin.condition && !f.admin.condition(doc, doc)).map((f) => f.name);
}

// Explicit param/return types (not `ServerLoad`): SvelteKit infers the generated route's
// `PageData` from the re-exported `load`'s return type.
export const load = async (event: RequestEvent): Promise<AdminData> => {
	const route = matchAdminRoute(event.params.path ?? '');
	if (!route) error(404, 'Not found');
	const { k, user, cms } = await requireAdmin(event, route.view);
	const title = k.config.admin.title;
	if (route.view === 'login') return { route, title };
	if (route.view === 'create-first-user') return { route, title };
	if (!user) error(401, 'Unauthorized'); // unreachable: requireAdmin redirects
	const base = { title, user: me(user), nav: nav(k) };
	const req = sysReq(k, user);

	if (route.view === 'dashboard') {
		const visible = k.config.collections.filter((c) => !c.admin.hidden);
		const counts = await Promise.all(
			visible.map((c) => cms.count(c.slug).catch(() => -1)), // -1: not readable
		);
		return {
			...base,
			route,
			collections: visible.map((c, i) => ({
				slug: c.slug,
				label: c.labels.plural,
				group: c.admin.group,
				description: c.admin.description,
				totalDocs: counts[i] ?? -1,
			})),
		};
	}

	const { col, client } = collectionFor(k, route.collection);

	if (route.view === 'list') {
		const query = listQuery(event.url, col);
		let where: WhereInput | undefined;
		if (query.q && col.admin.listSearchableFields.length > 0) {
			where = { or: col.admin.listSearchableFields.map((f) => ({ [f]: { like: query.q } })) };
		}
		try {
			const res = await cms.find(col.slug, { where, sort: query.sort as never, limit: query.limit, page: query.page });
			return {
				...base,
				route,
				collection: client,
				permissions: await permissions(col, req),
				query,
				docs: res.docs as AdminDoc[],
				totalDocs: res.totalDocs,
				totalPages: res.totalPages,
			};
		} catch (err) {
			throw toHttpError(err);
		}
	}

	if (route.view === 'create') {
		const perms = await permissions(col, req);
		if (!perms.create) error(403, 'You may not create documents here.');
		const doc: Record<string, unknown> = {};
		for (const f of col.fields) {
			if (f.defaultValue !== undefined && typeof f.defaultValue !== 'function') doc[f.name] = f.defaultValue;
		}
		return { ...base, route, collection: client, permissions: perms, doc };
	}

	const doc = await cms.findByID(col.slug, route.id).catch((err: unknown) => {
		throw toHttpError(err);
	});
	if (!doc) error(404, 'Document not found');
	return {
		...base,
		route,
		collection: client,
		permissions: await permissions(col, req, route.id),
		doc: doc as AdminDoc,
		hiddenFields: hiddenFields(col, doc),
		isSelf: col.auth && doc.id === user.id,
	};
};

function toHttpError(err: unknown): never {
	if (isKitcmsError(err)) error(err.status, err.message);
	throw err;
}

/** Maps pipeline errors to action failures; rethrows anything unexpected. */
function failWith(err: unknown, values?: Record<string, unknown>) {
	if (err instanceof ValidationError) {
		return fail(400, { message: err.message, errors: err.errors, values } satisfies AdminActionData);
	}
	if (err instanceof ReferencedError) {
		return fail(409, { message: err.message, references: err.references } satisfies AdminActionData);
	}
	if (isKitcmsError(err)) return fail(err.status, { message: err.message, values } satisfies AdminActionData);
	throw err;
}

function checkOrigin(event: RequestEvent): void {
	const origin = event.request.headers.get('origin');
	if (!origin || origin !== event.url.origin) error(403, 'Cross-origin request blocked');
}

function routeOf(event: RequestEvent): AdminRoute {
	const route = matchAdminRoute(event.params.path ?? '');
	if (!route) error(404, 'Not found');
	return route;
}

export const actions: Actions = {
	login: async (event) => {
		checkOrigin(event);
		const k = getKitcms(event.locals);
		const form = await event.request.formData();
		const { signIn } = await auth();
		const result = await signIn(k, {
			email: formString(form, 'email'),
			password: formString(form, 'password'),
			headers: event.request.headers,
		});
		if (!result.ok) return fail(result.status, { message: result.message } satisfies AdminActionData);
		redirect(303, adminUrl(''));
	},

	logout: async (event) => {
		checkOrigin(event);
		const k = getKitcms(event.locals);
		const { signOut } = await auth();
		await signOut(k, event.request.headers);
		redirect(303, adminUrl('login'));
	},

	createFirstUser: async (event) => {
		checkOrigin(event);
		const k = getKitcms(event.locals);
		const form = await event.request.formData();
		const { createFirstAdmin, signIn } = await auth();
		const email = formString(form, 'email');
		const password = formString(form, 'password');
		const created = await createFirstAdmin(k, { name: formString(form, 'name'), email, password });
		if (!created.ok) return fail(created.status, { message: created.message } satisfies AdminActionData);
		const signedIn = await signIn(k, { email, password, headers: event.request.headers });
		redirect(303, adminUrl(signedIn.ok ? '' : 'login'));
	},

	save: async (event) => {
		checkOrigin(event);
		const route = routeOf(event);
		if (route.view !== 'edit' && route.view !== 'create') error(404, 'Not found');
		const { k, cms } = await requireAdmin(event, route.view);
		const { col } = collectionFor(k, route.collection);
		const form = await event.request.formData();
		const { data, errors } = parseFormData(col.fields, form);
		if (errors.length > 0) return fail(400, { message: 'Invalid input', errors, values: data } satisfies AdminActionData);

		if (route.view === 'create') {
			let id: string;
			try {
				if (col.auth) {
					const { createUserWithPassword } = await auth();
					const doc = await createUserWithPassword(k, {
						...data,
						password: formString(form, FORM.password),
					});
					id = doc.id;
				} else {
					id = ((await cms.create(col.slug, data)) as { id: string }).id;
				}
			} catch (err) {
				return failWith(err, data);
			}
			redirect(303, adminUrl(`collections/${col.slug}/${id}`));
		}

		try {
			await cms.update(col.slug, route.id, data);
		} catch (err) {
			return failWith(err, data);
		}
		return { saved: true } satisfies AdminActionData;
	},

	delete: async (event) => {
		checkOrigin(event);
		const route = routeOf(event);
		if (route.view !== 'edit') error(404, 'Not found');
		const { k, cms } = await requireAdmin(event, route.view);
		const { col } = collectionFor(k, route.collection);
		try {
			await cms.delete(col.slug, route.id);
		} catch (err) {
			return failWith(err);
		}
		redirect(303, adminUrl(`collections/${col.slug}`));
	},

	bulkDelete: async (event) => {
		checkOrigin(event);
		const route = routeOf(event);
		if (route.view !== 'list') error(404, 'Not found');
		const { k, cms } = await requireAdmin(event, route.view);
		const { col } = collectionFor(k, route.collection);
		const form = await event.request.formData();
		const ids = form.getAll(FORM.ids).filter((v): v is string => typeof v === 'string').slice(0, 100);
		const failed: string[] = [];
		for (const id of ids) {
			try {
				await cms.delete(col.slug, id);
			} catch (err) {
				if (!isKitcmsError(err)) throw err;
				failed.push(id);
			}
		}
		if (failed.length > 0) {
			return fail(409, {
				message: `${failed.length} of ${ids.length} could not be deleted (in use or not allowed).`,
			} satisfies AdminActionData);
		}
		return { saved: true } satisfies AdminActionData;
	},

	setPassword: async (event) => {
		checkOrigin(event);
		const route = routeOf(event);
		if (route.view !== 'edit') error(404, 'Not found');
		const { k, user } = await requireAdmin(event, route.view);
		const { col } = collectionFor(k, route.collection);
		if (!col.auth || !user) error(404, 'Not found');
		const form = await event.request.formData();
		const { setPassword } = await auth();
		const result = await setPassword(k, {
			userId: route.id,
			newPassword: formString(form, FORM.password),
			currentPassword: formString(form, FORM.currentPassword) || undefined,
			headers: event.request.headers,
		});
		if (!result.ok) return fail(result.status, { message: result.message } satisfies AdminActionData);
		return { passwordChanged: true } satisfies AdminActionData;
	},
};
