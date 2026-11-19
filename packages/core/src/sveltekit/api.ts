// The package-provided API route, re-exported by the generated route file
// `src/routes/(kitcms)/api/[...path]/+server.ts`:
//   export { GET, POST, PATCH, DELETE } from '@kitcms/core/sveltekit/api';
// (Better Auth's `/api/auth/*` is served earlier, by the handle.)
//
// Admin JSON endpoints (session + admin access required; Local API as the user, so collection and
// field access apply):
//   GET  /api/admin/search/:collection?q=&limit=[&page=]   → { docs: PickerDoc[], hasNextPage? }
//   GET  /api/admin/lookup/:collection?ids=a,b,c   → { docs: PickerDoc[] }   (≤ 90 ids)
// Uploads and files (R2, §4.8; implemented by the upload task in ../upload):
//   POST /api/upload/:collection                  (multipart: file + other fields)
//   GET  /api/media/<key>                         (when `media.publicUrl` is unset)
// The REST fallback API (/api/collections/*, /api/globals/*; plan §13.7) lives in ./rest.
// Plugin endpoints (/api/plugins/<plugin>/*; Decision 33) live in ./plugins.
// Server-to-server setup (POST /api/system/*; Decision 43) lives in ./system.

import type { RequestEvent } from '@sveltejs/kit';
import { adminAccess } from '../access/engine';
import type { WhereInput } from '../config/where';
import { isKitcmsError } from '../errors';
import { getKitcms, type KitcmsInternals } from './index';

/** A compact document for relationship/upload pickers. */
export interface PickerDoc {
	id: string;
	/** The `useAsTitle` value, or the id. */
	title: string;
	/** Upload collections only. */
	url?: string;
	mimeType?: string;
	filename?: string;
	width?: number | null;
	height?: number | null;
	filesize?: number;
}

const MAX_IDS = 90;

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function errorResponse(status: number, message: string): Response {
	return json({ error: message }, status);
}

/** Session + admin access. Returns the internals, or an error response. */
async function requireAdminApi(event: RequestEvent): Promise<KitcmsInternals | Response> {
	const k = getKitcms(event.locals);
	if (!k.user) return errorResponse(401, 'Sign in to continue.');
	const ok = await adminAccess(k.config, { user: k.user, context: {}, cms: k.cms, source: 'admin' });
	if (!ok) return errorResponse(403, 'You do not have access to the admin.');
	return k;
}

function toPicker(k: KitcmsInternals, slug: string, doc: Record<string, unknown>): PickerDoc {
	const col = k.config.collectionsBySlug[slug];
	const titleKey = col?.admin.useAsTitle ?? 'id';
	const raw = doc[titleKey];
	const out: PickerDoc = {
		id: String(doc.id),
		title: raw === undefined || raw === null || raw === '' ? String(doc.id) : String(raw),
	};
	if (col?.upload) {
		out.url = typeof doc.url === 'string' ? doc.url : undefined;
		out.mimeType = typeof doc.mimeType === 'string' ? doc.mimeType : undefined;
		out.filename = typeof doc.filename === 'string' ? doc.filename : undefined;
		out.width = typeof doc.width === 'number' ? doc.width : null;
		out.height = typeof doc.height === 'number' ? doc.height : null;
		out.filesize = typeof doc.filesize === 'number' ? doc.filesize : undefined;
	}
	return out;
}

async function adminSearch(event: RequestEvent, slug: string): Promise<Response> {
	const k = await requireAdminApi(event);
	if (k instanceof Response) return k;
	const col = k.config.collectionsBySlug[slug];
	if (!col) return errorResponse(404, `Unknown collection "${slug}".`);
	const q = (event.url.searchParams.get('q') ?? '').slice(0, 200);
	const limit = Math.min(Math.max(Number(event.url.searchParams.get('limit')) || 10, 1), 50);
	const searchable = col.admin.listSearchableFields.length
		? col.admin.listSearchableFields
		: col.admin.useAsTitle !== 'id'
			? [col.admin.useAsTitle]
			: [];
	let where: WhereInput | undefined;
	if (q) {
		const ors: WhereInput[] = searchable.map((f) => ({ [f]: { like: q } }));
		ors.push({ id: { equals: q } });
		where = { or: ors };
	}
	const cms = k.cmsFor(k.user, 'admin');
	const pageParam = event.url.searchParams.get('page');
	if (pageParam !== null) {
		// Paged mode (media picker "Load more"): counts included, newest first.
		const page = Math.max(Math.floor(Number(pageParam)) || 1, 1);
		const res = await cms.find(slug, { where, limit, page, sort: col.defaultSort as never });
		return json({ docs: res.docs.map((d) => toPicker(k, slug, d)), hasNextPage: res.hasNextPage });
	}
	const res = await cms.find(slug, { where, limit, pagination: false });
	return json({ docs: res.docs.map((d) => toPicker(k, slug, d)) });
}

async function adminLookup(event: RequestEvent, slug: string): Promise<Response> {
	const k = await requireAdminApi(event);
	if (k instanceof Response) return k;
	if (!k.config.collectionsBySlug[slug]) return errorResponse(404, `Unknown collection "${slug}".`);
	const ids = [
		...new Set(
			(event.url.searchParams.get('ids') ?? '')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		),
	];
	if (ids.length === 0) return json({ docs: [] });
	if (ids.length > MAX_IDS) return errorResponse(400, `At most ${MAX_IDS} ids.`);
	const cms = k.cmsFor(k.user, 'admin');
	const res = await cms.find(slug, { where: { id: { in: ids } }, limit: MAX_IDS, pagination: false });
	return json({ docs: res.docs.map((d) => toPicker(k, slug, d)) });
}

function segments(event: RequestEvent): string[] {
	return (event.params.path ?? '').split('/').filter(Boolean);
}

async function handle(event: RequestEvent, fn: () => Promise<Response>): Promise<Response> {
	try {
		return await fn();
	} catch (err) {
		if (isKitcmsError(err)) return errorResponse(err.status, err.message);
		throw err;
	}
}

/** `/api/plugins/<plugin>/*` (Decision 33): dispatched to the lazily imported plugin module. */
async function plugins(
	event: RequestEvent,
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
): Promise<Response | null> {
	const segs = segments(event);
	if (segs[0] !== 'plugins') return null;
	const { handlePluginEndpoint } = await import('./plugins');
	return handlePluginEndpoint(event, getKitcms(event.locals), method, segs.slice(1));
}

/** `/api/collections/*` and `/api/globals/*`: dispatched to the lazily imported REST module. */
async function rest(event: RequestEvent, method: 'GET' | 'POST' | 'PATCH' | 'DELETE'): Promise<Response | null> {
	const segs = segments(event);
	if (segs[0] !== 'collections' && segs[0] !== 'globals') return null;
	const { handleRest } = await import('./rest');
	return handleRest(event, getKitcms(event.locals), method, segs);
}

export async function GET(event: RequestEvent): Promise<Response> {
	const [a, b, c, ...rest_] = segments(event);
	return handle(event, async () => {
		const r = (await rest(event, 'GET')) ?? (await plugins(event, 'GET'));
		if (r) return r;
		if (a === 'admin' && b === 'search' && c && rest_.length === 0) return adminSearch(event, c);
		if (a === 'admin' && b === 'lookup' && c && rest_.length === 0) return adminLookup(event, c);
		if (a === 'media' && b) {
			const { serveMedia } = await import('../upload/serve');
			return serveMedia(event, [b, c, ...rest_].filter((s): s is string => Boolean(s)).join('/'));
		}
		return errorResponse(404, 'Not found.');
	});
}

export async function POST(event: RequestEvent): Promise<Response> {
	const [a, b, ...rest_] = segments(event);
	return handle(event, async () => {
		const r = (await rest(event, 'POST')) ?? (await plugins(event, 'POST'));
		if (r) return r;
		if (a === 'system') {
			// Server-to-server setup (Decision 43): bearer token, no session or Origin.
			const { handleSystem } = await import('./system');
			return handleSystem(event, getKitcms(event.locals), [b, ...rest_].filter((s): s is string => Boolean(s)));
		}
		if (a === 'upload' && b && rest_.length === 0) {
			const origin = event.request.headers.get('origin');
			if (!origin || origin !== event.url.origin) return errorResponse(403, 'Cross-origin request blocked.');
			const k = await requireAdminApi(event);
			if (k instanceof Response) return k;
			const { handleUpload } = await import('../upload/handler');
			return handleUpload(event, k, b);
		}
		return errorResponse(404, 'Not found.');
	});
}

export async function PATCH(event: RequestEvent): Promise<Response> {
	return handle(
		event,
		async () =>
			(await rest(event, 'PATCH')) ??
			(await plugins(event, 'PATCH')) ??
			errorResponse(404, 'Not found.'),
	);
}

export async function DELETE(event: RequestEvent): Promise<Response> {
	return handle(
		event,
		async () =>
			(await rest(event, 'DELETE')) ??
			(await plugins(event, 'DELETE')) ??
			errorResponse(404, 'Not found.'),
	);
}
