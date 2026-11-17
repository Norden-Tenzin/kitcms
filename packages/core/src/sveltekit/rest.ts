// The REST fallback API (plan §13.7), lazily imported by ./api.ts. Prefer Service Binding RPC on
// Cloudflare; this exists for browsers and third parties that can't use a binding.
//
//   GET    /api/collections/:slug              find        POST   create (201)
//   GET    /api/collections/:slug/:id          findByID    PATCH  update    DELETE  delete
//   POST   /api/collections/:slug/:id/move                 { before } | { after }
//   POST   /api/collections/:slug/:id/unpublish
//   GET    /api/globals/:slug                  findGlobal  PATCH  updateGlobal
//
// One pipeline: the caller is the session user (or anonymous) via `cmsFor(user, 'rest')`.
// Nothing in the request (query, body, headers) can widen access: only whitelisted options are
// forwarded and `overrideAccess` is never set.

import type { RequestEvent } from '@sveltejs/kit';
import { isKitcmsError, ReferencedError, ValidationError } from '../errors';
import type { KitcmsInternals } from './index';

export type RestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export const MAX_BODY_BYTES = 1024 * 1024;
const MAX_DEPTH = 2;

/** Thrown inside the handler to produce a plain `{ error }` response. */
class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly headers?: Record<string, string>,
	) {
		super(message);
	}
}

function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
	return Response.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

function errorResponse(err: unknown): Response {
	if (err instanceof HttpError) return json({ error: err.message }, err.status, err.headers);
	if (isKitcmsError(err)) {
		const body: Record<string, unknown> = { error: err.message, code: err.code };
		if (err instanceof ValidationError) body.errors = err.errors;
		if (err instanceof ReferencedError) body.references = err.references;
		return json(body, err.status);
	}
	console.error('kitcms: unexpected REST error', err);
	return json({ error: 'Internal error' }, 500);
}

const has = (o: object, k: string) => Object.hasOwn(o, k);

function intParam(url: URL, name: string, min: number, max: number): number | undefined {
	const raw = url.searchParams.get(name);
	if (raw === null) return undefined;
	if (!/^\d{1,9}$/.test(raw)) throw new HttpError(400, `"${name}" must be an integer.`);
	const n = Number(raw);
	if (n < min || n > max) throw new HttpError(400, `"${name}" must be between ${min} and ${max}.`);
	return n;
}

function boolParam(url: URL, name: string, truthy: string): boolean | undefined {
	const raw = url.searchParams.get(name);
	if (raw === null) return undefined;
	if (raw === 'true' || raw === 'false') return raw === truthy;
	throw new HttpError(400, `"${name}" must be "true" or "false".`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `depth` and `draft`, shared by reads and writes. */
function commonOptions(url: URL): { depth?: number; draft?: boolean } {
	const out: { depth?: number; draft?: boolean } = {};
	const depth = intParam(url, 'depth', 0, MAX_DEPTH);
	if (depth !== undefined) out.depth = depth;
	const draft = boolParam(url, 'draft', 'true');
	if (draft !== undefined) out.draft = draft;
	return out;
}

/** Drafts are never readable anonymously (same rule as RPC, §13.8). */
function readOptions(k: KitcmsInternals, url: URL): { depth?: number; draft?: boolean } {
	const o = commonOptions(url);
	if (o.draft && !k.user) throw new HttpError(403, 'Sign in to read drafts.');
	return o;
}

function findArgs(k: KitcmsInternals, url: URL): Record<string, unknown> {
	const args: Record<string, unknown> = { ...readOptions(k, url) };
	const where = url.searchParams.get('where');
	if (where !== null) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(where);
		} catch {
			throw new HttpError(400, '"where" must be valid JSON.');
		}
		if (!isPlainObject(parsed)) throw new HttpError(400, '"where" must be a JSON object.');
		args.where = parsed;
	}
	const sort = url.searchParams.get('sort');
	if (sort !== null) {
		if (sort === '' || sort.length > 200) throw new HttpError(400, '"sort" is invalid.');
		args.sort = sort;
	}
	const limit = intParam(url, 'limit', 1, 1000);
	if (limit !== undefined) args.limit = limit;
	const page = intParam(url, 'page', 1, 1_000_000);
	if (page !== undefined) args.page = page;
	const pagination = boolParam(url, 'pagination', 'true');
	if (pagination !== undefined) args.pagination = pagination;
	return args;
}

/** CSRF: browsers always send `Origin` on cross-origin non-GET requests. Missing or foreign → 403. */
function checkOrigin(event: RequestEvent): void {
	const origin = event.request.headers.get('origin');
	if (!origin || origin !== event.url.origin) throw new HttpError(403, 'Cross-origin request blocked.');
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
	const type = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
	if (type !== 'application/json') throw new HttpError(415, 'Content-Type must be application/json.');
	const tooLarge = () => new HttpError(413, 'Request body is too large (max 1 MiB).');
	const declared = request.headers.get('content-length');
	if (declared !== null && Number(declared) > MAX_BODY_BYTES) throw tooLarge();

	const chunks: Uint8Array[] = [];
	let total = 0;
	if (request.body) {
		const reader = request.body.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_BODY_BYTES) {
				await reader.cancel().catch(() => {});
				throw tooLarge();
			}
			chunks.push(value);
		}
	}
	const bytes = new Uint8Array(total);
	let off = 0;
	for (const c of chunks) {
		bytes.set(c, off);
		off += c.byteLength;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
	} catch {
		throw new HttpError(400, 'Request body must be valid JSON.');
	}
	if (!isPlainObject(parsed)) throw new HttpError(400, 'Request body must be a JSON object.');
	return parsed;
}

function methodNotAllowed(allowed: RestMethod[]): never {
	throw new HttpError(405, 'Method not allowed.', { allow: allowed.join(', ') });
}

type Dyn = (...args: unknown[]) => Promise<unknown>;

/**
 * Handles a request under `/api/collections/*` or `/api/globals/*`. `segs` are the decoded path
 * segments after `/api`. Always returns a response (never throws).
 */
export async function handleRest(
	event: RequestEvent,
	k: KitcmsInternals,
	method: RestMethod,
	segs: string[],
): Promise<Response> {
	try {
		if (!k.config.rest) throw new HttpError(404, 'Not found.');
		if (method !== 'GET') checkOrigin(event); // before anything else, before the body
		return await route(event, k, method, segs);
	} catch (err) {
		return errorResponse(err);
	}
}

async function route(
	event: RequestEvent,
	k: KitcmsInternals,
	method: RestMethod,
	[kind, slug, id, action, ...extra]: string[],
): Promise<Response> {
	if (!slug || extra.length > 0) throw new HttpError(404, 'Not found.');
	const url = event.url;
	// The caller is always the session user (or anonymous). Never overrideAccess.
	const cms = k.cmsFor(k.user, 'rest') as unknown as Record<string, Dyn | undefined>;
	const call = (name: string, ...args: unknown[]): Promise<unknown> => {
		const fn = cms[name];
		if (typeof fn !== 'function') throw new HttpError(501, `"${name}" is not available.`);
		return fn.apply(cms, args);
	};

	if (kind === 'globals') {
		if (id !== undefined || !has(k.config.globalsBySlug, slug)) throw new HttpError(404, 'Not found.');
		if (method === 'GET') return json(await call('findGlobal', slug, readOptions(k, url)));
		if (method === 'PATCH') {
			const opts = commonOptions(url);
			const data = await readBody(event.request);
			return json(await call('updateGlobal', slug, data, opts));
		}
		return methodNotAllowed(['GET', 'PATCH']);
	}

	// collections
	if (!has(k.config.collectionsBySlug, slug)) throw new HttpError(404, 'Not found.');
	const col = k.config.collectionsBySlug[slug]!;

	if (id === undefined) {
		if (method === 'GET') return json(await call('find', slug, findArgs(k, url)));
		if (method === 'POST') {
			if (col.upload) {
				throw new HttpError(405, `"${slug}" is an upload collection: POST files to /api/upload/${slug}.`, {
					allow: 'GET',
				});
			}
			if (slug === k.config.authCollection) {
				throw new HttpError(405, 'Users are created in the admin.', { allow: 'GET' });
			}
			const opts = commonOptions(url);
			const data = await readBody(event.request);
			return json(await call('create', slug, data, opts), 201);
		}
		return methodNotAllowed(col.upload || slug === k.config.authCollection ? ['GET'] : ['GET', 'POST']);
	}

	if (action === undefined) {
		if (method === 'GET') {
			const doc = await call('findByID', slug, id, readOptions(k, url));
			if (doc === null || doc === undefined) throw new HttpError(404, 'Not found.');
			return json(doc);
		}
		if (method === 'PATCH') {
			const opts = commonOptions(url);
			const data = await readBody(event.request);
			return json(await call('update', slug, id, data, opts));
		}
		if (method === 'DELETE') return json(await call('delete', slug, id));
		return methodNotAllowed(['GET', 'PATCH', 'DELETE']);
	}

	if (action === 'move') {
		if (method !== 'POST') return methodNotAllowed(['POST']);
		const body = await readBody(event.request);
		const { before, after } = body;
		const okBefore = typeof before === 'string' && before !== '';
		const okAfter = typeof after === 'string' && after !== '';
		if (okBefore === okAfter) throw new HttpError(400, 'Provide exactly one of "before" or "after" (an id).');
		return json(await call('move', slug, id, okBefore ? { before } : { after }));
	}
	if (action === 'unpublish') {
		if (method !== 'POST') return methodNotAllowed(['POST']);
		return json(await call('unpublish', slug, id));
	}
	throw new HttpError(404, 'Not found.');
}
