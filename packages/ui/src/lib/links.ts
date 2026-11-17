// Admin URL helpers. The generated route file always lives at this route id; resolve() applies `paths.base`.
import { resolve } from '$app/paths';

const ADMIN = '/(kitcms)/admin/[...path]';

/** `path` is relative to the admin root: '', `collections/posts`, `collections/posts/create`. */
export function adminHref(path = '', query?: Record<string, string | number | undefined>): string {
	const base = resolve(ADMIN, { path });
	if (!query) return base;
	const params = new URLSearchParams();
	for (const [k, v] of Object.entries(query)) {
		if (v !== undefined && v !== '') params.set(k, String(v));
	}
	const qs = params.toString();
	return qs ? `${base}?${qs}` : base;
}

export const collectionHref = (slug: string, query?: Record<string, string | number | undefined>) =>
	adminHref(`collections/${slug}`, query);
export const docHref = (slug: string, id: string) => adminHref(`collections/${slug}/${id}`);
export const createHref = (slug: string) => adminHref(`collections/${slug}/create`);
export const globalHref = (slug: string) => adminHref(`globals/${slug}`);
export const versionsHref = (slug: string, id: string) => adminHref(`collections/${slug}/${id}/versions`);
export const globalVersionsHref = (slug: string) => adminHref(`globals/${slug}/versions`);

const GLOBAL_PREFIX = '_global_';
/** Where a document of `collection` is edited. `_global_<slug>` (refs from a global) links to the global. */
export const refHref = (collection: string, id: string) =>
	collection.startsWith(GLOBAL_PREFIX) ? globalHref(collection.slice(GLOBAL_PREFIX.length)) : docHref(collection, id);
