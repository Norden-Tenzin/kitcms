// The package-provided API route, re-exported by the generated route file
// `src/routes/(kitcms)/api/[...path]/+server.ts`:
//   export { GET, POST } from '@kitcms/core/sveltekit/api';
// (Better Auth's `/api/auth/*` is served earlier, by the handle.)
//
// Admin JSON endpoints (session + admin access required; Local API as the user, so collection and
// field access apply):
//   GET  /api/admin/search/:collection?q=&limit=[&page=]   → { docs: PickerDoc[], hasNextPage? }
//   GET  /api/admin/lookup/:collection?ids=a,b,c   → { docs: PickerDoc[] }   (≤ 90 ids)
// Uploads and files (R2, §4.8; implemented by the upload task in ../upload):
//   POST /api/upload/:collection                  (multipart: file + other fields)
//   GET  /api/media/<key>                         (when `media.publicUrl` is unset)
// The REST fallback API (/api/:collection, Phase 2) will live here too.

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

export async function GET(event: RequestEvent): Promise<Response> {
	const [a, b, c, ...rest] = segments(event);
	return handle(event, async () => {
		if (a === 'admin' && b === 'search' && c && rest.length === 0) return adminSearch(event, c);
		if (a === 'admin' && b === 'lookup' && c && rest.length === 0) return adminLookup(event, c);
		if (a === 'media' && b) {
			const { serveMedia } = await import('../upload/serve');
			return serveMedia(event, [b, c, ...rest].filter((s): s is string => Boolean(s)).join('/'));
		}
		return errorResponse(404, 'Not found.');
	});
}

export async function POST(event: RequestEvent): Promise<Response> {
	const [a, b, ...rest] = segments(event);
	return handle(event, async () => {
		if (a === 'upload' && b && rest.length === 0) {
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
