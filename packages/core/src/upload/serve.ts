// GET /api/media/<key>: serves R2 objects through the Local API's read access (the request user).
import type { RequestEvent } from '@sveltejs/kit';
import { isKitcmsError } from '../errors';
import { getKitcms, type KitcmsInternals } from '../sveltekit/index';
import {
	cacheControl,
	contentDisposition,
	MEDIA_CSP,
	parseRange,
	validKey,
} from './sniff';

/** Access/query failures read as "not found"; anything else (D1 down, bugs) must surface. */
function notFoundOnly(err: unknown): null {
	if (isKitcmsError(err)) return null;
	throw err;
}

const notFound = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });

export function serveMedia(event: RequestEvent, key: string): Promise<Response> {
	return serveMediaWith(event, getKitcms(event.locals), key);
}

export async function serveMediaWith(
	event: RequestEvent,
	k: KitcmsInternals,
	key: string,
): Promise<Response> {
	if (!validKey(key)) return notFound();
	const storage = k.storage;
	if (!storage) return notFound();

	let found: Record<string, unknown> | null = null;
	let foundSlug = '';
	for (const col of k.config.collections) {
		if (!col.upload) continue;
		// A denied read (ForbiddenError) is indistinguishable from "not found".
		const doc = (await k.cms
			.findOne(col.slug, { where: { key: { equals: key } } })
			.catch(notFoundOnly)) as Record<string, unknown> | null;
		if (doc && doc.key === key) {
			found = doc;
			foundSlug = col.slug;
			break;
		}
	}
	if (!found) return notFound();

	// Public only if an anonymous read would succeed too (only checked for signed-in users).
	let isPublic = true;
	if (k.user) {
		const anon = await k
			.cmsFor(null)
			.findOne(foundSlug, { where: { key: { equals: key } } })
			.catch(notFoundOnly);
		isPublic = !!anon;
	}

	const mime = typeof found.mimeType === 'string' ? found.mimeType : 'application/octet-stream';
	const etagHeader = event.request.headers.get('if-none-match');
	const headers = new Headers({
		'content-type': mime,
		'cache-control': cacheControl(isPublic),
		'x-content-type-options': 'nosniff',
		'content-security-policy': MEDIA_CSP,
		'accept-ranges': 'bytes',
		'cross-origin-resource-policy': 'same-origin',
	});
	const name = String(found.filename ?? 'file').replace(/[^\w.\- ]+/g, '_');
	headers.set(
		'content-disposition',
		contentDisposition(mime) === 'inline' ? 'inline' : `attachment; filename="${name}"`,
	);
	if (!isPublic) headers.append('vary', 'cookie');

	const size = typeof found.filesize === 'number' ? found.filesize : undefined;
	const range = size !== undefined ? parseRange(event.request.headers.get('range'), size) : { kind: 'none' as const };
	if (range.kind === 'unsatisfiable') {
		headers.set('content-range', `bytes */${size}`);
		return new Response(null, { status: 416, headers });
	}

	const obj = await storage.get(key, {
		range:
			range.kind === 'range'
				? { offset: range.start, length: range.end - range.start + 1 }
				: undefined,
		onlyIf: etagHeader ? { etagDoesNotMatch: etagHeader.replace(/^W\//, '').replace(/"/g, '') } : undefined,
	});
	if (!obj) return notFound();
	headers.set('etag', obj.httpEtag);
	if (!obj.body) return new Response(null, { status: 304, headers });

	if (obj.range && range.kind === 'range') {
		headers.set('content-range', `bytes ${obj.range.offset}-${obj.range.offset + obj.range.length - 1}/${obj.size}`);
		headers.set('content-length', String(obj.range.length));
		return new Response(obj.body, { status: 206, headers });
	}
	headers.set('content-length', String(obj.size));
	return new Response(obj.body, { status: 200, headers });
}
