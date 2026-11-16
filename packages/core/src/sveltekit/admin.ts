// SPIKE (Phase 0): admin `load` + `actions` shipped by the package and re-exported by a
// generated route file `src/routes/(kitcms)/admin/[...path]/+page.server.ts`.
// The admin has an internal router over `params.path`, so upgrades never need new route files.
import { error, fail, type Actions, type ServerLoadEvent } from '@sveltejs/kit';
import type { Doc, KitcmsCollectionMeta } from './index.ts';

export type AdminRoute =
	| { view: 'dashboard' }
	| { view: 'list'; collection: string }
	| { view: 'edit'; collection: string; id: string };

export function matchAdminRoute(path: string): AdminRoute | null {
	const parts = path.split('/').filter(Boolean);
	if (parts.length === 0) return { view: 'dashboard' };
	if (parts[0] !== 'collections' || !parts[1]) return null;
	if (parts.length === 2) return { view: 'list', collection: parts[1] };
	if (parts.length === 3 && parts[2]) return { view: 'edit', collection: parts[1], id: parts[2] };
	return null;
}

/** What the admin `load` returns. The single type shared by core (producer) and @kitcms/ui (consumer). */
export interface AdminData {
	route: AdminRoute;
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

// Explicit param/return types (not `ServerLoad`): SvelteKit infers the generated route's
// `PageData` from the re-exported `load`'s return type.
export const load = async ({ params, locals }: ServerLoadEvent): Promise<AdminData> => {
	const route = matchAdminRoute(params.path ?? '');
	if (!route) error(404, 'Not found');
	const { cms } = locals;
	const collections = cms.collections;

	if (route.view === 'dashboard') return { route, collections };

	const meta = collections.find((c) => c.slug === route.collection);
	if (!meta) error(404, `Unknown collection "${route.collection}"`);

	if (route.view === 'list') {
		const { docs } = await cms.find(meta.slug, { limit: 50 });
		return { route, collections, meta, docs };
	}
	const doc = await cms.findByID(meta.slug, route.id);
	if (!doc) error(404, 'Document not found');
	return { route, collections, meta, doc };
};

export const actions: Actions = {
	save: async ({ params, locals, request }) => {
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
