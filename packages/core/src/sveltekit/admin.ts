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
import { mayActOn, userTenantsOf } from '../access/tenancy';
import { FORM, formString, parseFormData } from '../admin/form';
import type {
	AdminActionData,
	AdminData,
	AdminDoc,
	AdminDocStatus,
	AdminPermissions,
	AdminRoute,
	AdminTenancy,
	ListQuery,
} from '../admin/types';
import type { Cms } from '../api/types';
import type { KitcmsReq, KitcmsUser } from '../config/hooks';
import type { ClientCollection, ClientConfig, SanitizedCollection, SanitizedConfig } from '../config/sanitized';
import { toClientConfig } from '../config/sanitize';
import type { WhereInput } from '../config/where';
import { TENANT_COOKIE } from '../config/tenancy';
import { isKitcmsError, ReferencedError, ValidationError } from '../errors';
import { parseBaseOrigin, useSecureCookies } from '../auth/cookies';
import { dev } from '$app/env';
import { getKitcms, type KitcmsInternals } from './index';
import { basePath } from './base';

export type * from '../admin/types';

export function matchAdminRoute(path: string): AdminRoute | null {
	const parts = path.split('/').filter(Boolean);
	if (parts.length === 0) return { view: 'dashboard' };
	if (parts.length === 1 && parts[0] === 'login') return { view: 'login' };
	if (parts.length === 1 && parts[0] === 'create-first-user') return { view: 'create-first-user' };
	if (parts[0] === 'globals' && parts.length === 2 && parts[1]) return { view: 'global', global: parts[1] };
	if (parts[0] === 'globals' && parts.length === 3 && parts[1] && parts[2] === 'versions') {
		return { view: 'versions', global: parts[1] };
	}
	if (parts[0] !== 'collections' || !parts[1]) return null;
	if (parts.length === 2) return { view: 'list', collection: parts[1] };
	if (parts.length === 3 && parts[2] === 'create') return { view: 'create', collection: parts[1] };
	if (parts.length === 3 && parts[2]) return { view: 'edit', collection: parts[1], id: parts[2] };
	if (parts.length === 4 && parts[2] && parts[3] === 'versions') {
		return { view: 'versions', collection: parts[1], id: parts[2] };
	}
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
	return { user, context: {}, cms: k.cms, source: 'admin', tenant: k.tenant };
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

function globalFor(k: KitcmsInternals, slug: string): { col: SanitizedCollection; client: ClientCollection } {
	const col = Object.hasOwn(k.config.globalsBySlug, slug) ? k.config.globalsBySlug[slug] : undefined;
	const client = clientConfig(k.config).globals.find((c) => c.globalSlug === slug);
	if (!col || !client) error(404, `Unknown global "${slug}"`);
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

function globalsNav(k: KitcmsInternals) {
	return k.config.globals
		.filter((g) => !g.admin.hidden)
		.map((g) => ({ slug: g.globalSlug as string, label: g.labels.singular, group: g.admin.group }));
}

function nav(k: KitcmsInternals) {
	return k.config.collections
		.filter((c) => !c.admin.hidden)
		.map((c) => ({ slug: c.slug, label: c.labels.plural, group: c.admin.group }));
}

function me(user: KitcmsUser) {
	return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** The tenant switcher state (§15.3). The tenants are read as the user (access already scopes them). */
async function tenancyBlock(k: KitcmsInternals, user: KitcmsUser, cms: Cms): Promise<AdminTenancy | null> {
	const t = k.config.tenancy;
	if (!t) return null;
	const col = k.config.collectionsBySlug[t.tenantsCollection];
	let tenants: AdminTenancy['tenants'] = [];
	try {
		const res = await cms.find(t.tenantsCollection, { limit: 100, pagination: false });
		const titleField = col?.admin.useAsTitle;
		tenants = res.docs.map((d) => {
			const v = titleField ? (d as Record<string, unknown>)[titleField] : undefined;
			return { id: d.id, title: typeof v === 'string' && v ? v : d.id };
		});
	} catch (err) {
		if (!isKitcmsError(err)) throw err;
	}
	return {
		current: k.tenant,
		field: t.field,
		scoped: [...t.collections],
		tenants,
		canSelectAll: userTenantsOf(t, user) === 'all',
	};
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

const hasDrafts = (col: SanitizedCollection) => col.versions !== false && col.versions.drafts !== false;

/**
 * Draft / published / changed. The document was read with `draft: true`, so its `_status` is
 * `'draft'` for both a never-published document and a published one with a newer draft: the
 * published read tells them apart (a published global reads as `_status: 'published'`).
 */
async function docStatus(
	col: SanitizedCollection,
	cms: Cms,
	doc: Record<string, unknown>,
	route: { collection: string; id: string } | { global: string },
): Promise<AdminDocStatus | undefined> {
	if (!hasDrafts(col)) return undefined;
	if (doc._status === 'published') return 'published';
	const published = 'global' in route ? await cms.findGlobal(route.global as never) : await cms.findByID(route.collection, route.id);
	return published && (published as Record<string, unknown>)._status === 'published' ? 'changed' : 'draft';
}

/** Number of versions the user may see, or `undefined` (none, or no access). */
async function versionCount(
	col: SanitizedCollection,
	cms: Cms,
	route: { collection: string; id: string } | { global: string },
): Promise<number | undefined> {
	if (col.versions === false) return undefined;
	try {
		const page =
			'global' in route
				? await cms.findGlobalVersions(route.global as never, { limit: 1 })
				: await cms.findVersions(route.collection, route.id, { limit: 1 });
		return page.totalDocs;
	} catch (err) {
		if (isKitcmsError(err)) return undefined;
		throw err;
	}
}

/** Top-level fields hidden by `admin.condition` for this document. */
function hiddenFields(col: SanitizedCollection, doc: Record<string, unknown>): string[] {
	return col.fields.filter((f) => f.admin.condition && !f.admin.condition(doc, doc)).map((f) => f.name);
}

// Explicit param/return types (not `ServerLoad`): SvelteKit infers the generated route's
// `PageData` from the re-exported `load`'s return type.
export const load = async (event: RequestEvent): Promise<AdminData> => {
	const started: { tenancy?: Promise<AdminTenancy | null> } = {};
	const data = await loadView(event, started);
	if (!started.tenancy) return data as AdminData; // login / first user: no switcher
	return { ...data, tenancy: await started.tenancy } as AdminData;
};

type WithoutTenancy = AdminData extends infer D ? (D extends unknown ? Omit<D, 'tenancy'> : never) : never;

async function loadView(
	event: RequestEvent,
	started: { tenancy?: Promise<AdminTenancy | null> },
): Promise<WithoutTenancy> {
	const route = matchAdminRoute(event.params.path ?? '');
	if (!route) error(404, 'Not found');
	const { k, user, cms } = await requireAdmin(event, route.view);
	const title = k.config.admin.title;
	const branding = k.config.admin.branding;
	if (route.view === 'login') return { route, title, branding };
	if (route.view === 'create-first-user') return { route, title, branding };
	if (!user) error(401, 'Unauthorized'); // unreachable: requireAdmin redirects
	const base = { title, branding, user: me(user), nav: nav(k), globals: globalsNav(k) };
	const req = sysReq(k, user);
	// Runs in parallel with the view's own queries; awaited by `load`.
	started.tenancy = tenancyBlock(k, user, cms);
	started.tenancy.catch(() => {}); // a failing view must not leave an unhandled rejection

	if (route.view === 'dashboard') {
		const visible = k.config.collections.filter((c) => !c.admin.hidden);
		const counts = await Promise.all(
			visible.map((c) => cms.count(c.slug, { draft: true }).catch(() => -1)), // -1: not readable
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
			globals: k.config.globals
				.filter((g) => !g.admin.hidden)
				.map((g) => ({
					slug: g.globalSlug as string,
					label: g.labels.singular,
					group: g.admin.group,
					description: g.admin.description,
				})),
		};
	}

	if (route.view === 'global') {
		const { col, client } = globalFor(k, route.global);
		const doc = await cms.findGlobal(route.global as never, { draft: true }).catch((err: unknown) => {
			throw toHttpError(err);
		});
		const update = (await collectionAccess(col, 'update', { req, id: route.global })) === true;
		const [status, count] = await Promise.all([
			docStatus(col, cms, doc as Record<string, unknown>, route),
			versionCount(col, cms, route),
		]);
		return {
			...base,
			route,
			collection: client,
			permissions: { create: false, update, delete: false },
			doc: doc as AdminDoc,
			hiddenFields: hiddenFields(col, doc as Record<string, unknown>),
			...(status ? { status } : {}),
			...(count !== undefined ? { versionCount: count } : {}),
		};
	}

	if (route.view === 'versions' && route.global !== undefined) {
		const { col, client } = globalFor(k, route.global);
		if (col.versions === false) error(404, 'This global has no versions.');
		const query = listQuery(event.url, col);
		try {
			const res = await cms.findGlobalVersions(route.global as never, { page: query.page, limit: 25 });
			return {
				...base,
				route,
				collection: client,
				permissions: { create: false, update: (await collectionAccess(col, 'update', { req, id: route.global })) === true, delete: false },
				docTitle: col.labels.singular,
				...versionsPage(col, res),
			};
		} catch (err) {
			throw toHttpError(err);
		}
	}

	const { col, client } = collectionFor(k, route.collection);

	if (route.view === 'versions') {
		if (col.versions === false) error(404, 'This collection has no versions.');
		const query = listQuery(event.url, col);
		try {
			const [res, current] = await Promise.all([
				cms.findVersions(col.slug, route.id!, { page: query.page, limit: 25 }),
				cms.findByID(col.slug, route.id!, { draft: true }),
			]);
			if (!current) error(404, 'Document not found');
			const title = (current as Record<string, unknown>)[col.admin.useAsTitle];
			return {
				...base,
				route,
				collection: client,
				permissions: await permissions(col, req, route.id),
				docTitle: typeof title === 'string' && title ? title : route.id!,
				...versionsPage(col, res),
			};
		} catch (err) {
			throw toHttpError(err);
		}
	}

	if (route.view === 'list') {
		const query = listQuery(event.url, col);
		let where: WhereInput | undefined;
		if (query.q && col.admin.listSearchableFields.length > 0) {
			where = { or: col.admin.listSearchableFields.map((f) => ({ [f]: { like: query.q } })) };
		}
		try {
			const res = await cms.find(col.slug, {
				where,
				sort: query.sort as never,
				limit: query.limit,
				page: query.page,
				draft: true,
			});
			const docs = res.docs as AdminDoc[];
			// A draft overlay reads `_status: 'draft'` even when a published version exists. One more
			// (admin-only) read tells "draft" from "published with newer draft changes".
			const overlaid = docs.filter((d) => d._status === 'draft').map((d) => d.id);
			if (col.versions && col.versions.drafts && overlaid.length > 0) {
				const published = await cms.find(col.slug, {
					where: { id: { in: overlaid } },
					limit: overlaid.length,
					pagination: false,
				});
				const live = new Set(published.docs.map((d) => d.id));
				for (const d of docs) if (d._status === 'draft' && live.has(d.id)) d._status = 'changed';
			}
			return {
				...base,
				route,
				collection: client,
				permissions: await permissions(col, req),
				query,
				docs,
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

	const doc = await cms.findByID(col.slug, route.id, { draft: true }).catch((err: unknown) => {
		throw toHttpError(err);
	});
	if (!doc) error(404, 'Document not found');
	const [status, count] = await Promise.all([
		docStatus(col, cms, doc, route),
		versionCount(col, cms, route),
	]);
	return {
		...base,
		route,
		collection: client,
		permissions: await permissions(col, req, route.id),
		doc: doc as AdminDoc,
		hiddenFields: hiddenFields(col, doc),
		isSelf: col.auth && doc.id === user.id,
		...(status ? { status } : {}),
		...(count !== undefined ? { versionCount: count } : {}),
	};
}

/** The paged versions list shaped for the versions view. */
function versionsPage(
	col: SanitizedCollection,
	res: { docs: { id: string; version: unknown; _status?: 'draft' | 'published'; autosave: boolean; latest: boolean; createdAt: string }[]; totalDocs: number; page: number; totalPages: number },
) {
	return {
		versions: res.docs.map((v) => {
			const label = (v.version as Record<string, unknown>)[col.admin.useAsTitle];
			return {
				id: v.id,
				...(v._status ? { status: v._status } : {}),
				autosave: v.autosave,
				latest: v.latest,
				createdAt: v.createdAt,
				...(typeof label === 'string' && label ? { label } : {}),
			};
		}),
		totalDocs: res.totalDocs,
		page: res.page,
		totalPages: res.totalPages,
	};
}

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

/** `{ draft, autosave }` from the form's submit-button flags (§13.4). Empty without drafts. */
function draftOptions(col: SanitizedCollection, form: FormData): { draft?: true; autosave?: true } {
	if (!hasDrafts(col) || !form.has(FORM.draft)) return {};
	return form.has(FORM.autosave) ? { draft: true, autosave: true } : { draft: true };
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
		if (route.view === 'global') {
			const { k, cms } = await requireAdmin(event, route.view);
			const { col } = globalFor(k, route.global);
			const form = await event.request.formData();
			const { data, errors } = parseFormData(col.fields, form);
			if (errors.length > 0) return fail(400, { message: 'Invalid input', errors, values: data } satisfies AdminActionData);
			try {
				await cms.updateGlobal(route.global as never, data as never, draftOptions(col, form));
			} catch (err) {
				return failWith(err, data);
			}
			return { saved: true } satisfies AdminActionData;
		}
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
					// No autosave on create: the document has no id yet (the form only offers "Save draft").
					id = ((await cms.create(col.slug, data, { ...draftOptions(col, form), autosave: undefined })) as { id: string }).id;
				}
			} catch (err) {
				return failWith(err, data);
			}
			redirect(303, adminUrl(`collections/${col.slug}/${id}`));
		}

		try {
			await cms.update(col.slug, route.id, data, draftOptions(col, form));
		} catch (err) {
			return failWith(err, data);
		}
		return { saved: true } satisfies AdminActionData;
	},

	unpublish: async (event) => {
		checkOrigin(event);
		const route = routeOf(event);
		if (route.view !== 'edit') error(404, 'Not found');
		const { k, cms } = await requireAdmin(event, route.view);
		const { col } = collectionFor(k, route.collection);
		if (!hasDrafts(col)) error(404, 'Not found');
		try {
			await cms.unpublish(col.slug, route.id);
		} catch (err) {
			return failWith(err);
		}
		return { saved: true } satisfies AdminActionData;
	},

	restoreVersion: async (event) => {
		checkOrigin(event);
		const route = routeOf(event);
		if (route.view !== 'versions') error(404, 'Not found');
		const { k, cms } = await requireAdmin(event, route.view);
		const form = await event.request.formData();
		const versionId = formString(form, FORM.versionId);
		if (!versionId) return fail(400, { message: 'Invalid version' } satisfies AdminActionData);
		if (route.global !== undefined) {
			const { col } = globalFor(k, route.global);
			try {
				await cms.restoreGlobalVersion(route.global as never, versionId, draftOptions(col, form));
			} catch (err) {
				return failWith(err);
			}
			redirect(303, adminUrl(`globals/${route.global}`));
		}
		const { col } = collectionFor(k, route.collection);
		try {
			await cms.restoreVersion(col.slug, versionId, draftOptions(col, form));
		} catch (err) {
			return failWith(err);
		}
		redirect(303, adminUrl(`collections/${col.slug}/${route.id}`));
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

	move: async (event) => {
		checkOrigin(event);
		const route = routeOf(event);
		if (route.view !== 'list') error(404, 'Not found');
		const { k, cms } = await requireAdmin(event, route.view);
		const { col } = collectionFor(k, route.collection);
		if (!col.orderable) error(404, 'Not found');
		const form = await event.request.formData();
		const id = formString(form, 'id');
		const before = formString(form, 'before');
		const after = formString(form, 'after');
		if (!id || Boolean(before) === Boolean(after)) {
			return fail(400, { message: 'Invalid move' } satisfies AdminActionData);
		}
		try {
			await cms.move(col.slug, id, (before ? { before } : { after }) as never);
		} catch (err) {
			return failWith(err);
		}
		return { saved: true } satisfies AdminActionData;
	},

	setTenant: async (event) => {
		checkOrigin(event);
		const { k, user } = await requireAdmin(event, 'dashboard');
		const t = k.config.tenancy;
		if (!t || !user) error(404, 'Not found');
		const tenant = formString(await event.request.formData(), 'tenant');
		const allowed = tenant === '' ? userTenantsOf(t, user) === 'all' : mayActOn(t, user, tenant);
		if (!allowed || !/^[A-Za-z0-9_-]{0,128}$/.test(tenant)) {
			return fail(403, { message: 'You cannot work on that tenant.' } satisfies AdminActionData);
		}
		// Same attributes as `serializeTenantCookie` (the value is re-validated on every request).
		event.cookies.set(TENANT_COOKIE, tenant, {
			path: `${basePath(event.url)}/`,
			httpOnly: true,
			sameSite: 'lax',
			secure: useSecureCookies({ dev, origin: parseBaseOrigin(k.env.BETTER_AUTH_URL) ?? event.url }),
			maxAge: 31536000,
		});
		redirect(303, adminUrl(''));
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
