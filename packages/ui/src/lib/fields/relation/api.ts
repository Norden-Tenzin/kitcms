// Client for the admin picker endpoints (packages/core/src/sveltekit/api.ts).
import { resolve } from '$app/paths';

/** Mirrors `PickerDoc` in @kitcms/core's sveltekit/api (kept local so the UI doesn't import server code). */
export interface PickerDoc {
	id: string;
	title: string;
	url?: string;
	mimeType?: string;
	filename?: string;
	width?: number | null;
	height?: number | null;
	filesize?: number;
}

const API = '/(kitcms)/api/[...path]';

export function searchUrl(collection: string, q: string, limit = 10, page?: number): string {
	const base = resolve(API, { path: `admin/search/${encodeURIComponent(collection)}` });
	const params = new URLSearchParams();
	if (q) params.set('q', q);
	params.set('limit', String(limit));
	if (page !== undefined) params.set('page', String(page));
	return `${base}?${params}`;
}

export function lookupUrl(collection: string, ids: string[]): string {
	const base = resolve(API, { path: `admin/lookup/${encodeURIComponent(collection)}` });
	return `${base}?${new URLSearchParams({ ids: ids.join(',') })}`;
}

async function getDocs(url: string, signal?: AbortSignal): Promise<PickerDoc[]> {
	const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
	if (!res.ok) throw new Error(`Request failed (${res.status})`);
	const body = (await res.json()) as { docs?: PickerDoc[] };
	return body.docs ?? [];
}

export const searchDocs = (collection: string, q: string, limit?: number, signal?: AbortSignal) =>
	getDocs(searchUrl(collection, q, limit), signal);

/** Lookup in chunks (the endpoint caps the id count). */
export async function lookupDocs(collection: string, ids: string[], signal?: AbortSignal): Promise<PickerDoc[]> {
	const out: PickerDoc[] = [];
	for (let i = 0; i < ids.length; i += 50) {
		out.push(...(await getDocs(lookupUrl(collection, ids.slice(i, i + 50)), signal)));
	}
	return out;
}

export const isImage = (doc: PickerDoc | undefined): doc is PickerDoc & { url: string } =>
	Boolean(doc?.url && doc.mimeType?.startsWith('image/'));

/** Paged search (media picker): newest first, with `hasNextPage` for "Load more". */
export async function searchPage(
	collection: string,
	q: string,
	page: number,
	limit = 24,
	signal?: AbortSignal,
): Promise<{ docs: PickerDoc[]; hasNextPage: boolean }> {
	const res = await fetch(searchUrl(collection, q, limit, page), { signal, headers: { accept: 'application/json' } });
	if (!res.ok) throw new Error(`Request failed (${res.status})`);
	const body = (await res.json()) as { docs?: PickerDoc[]; hasNextPage?: boolean };
	return { docs: body.docs ?? [], hasNextPage: Boolean(body.hasNextPage) };
}
