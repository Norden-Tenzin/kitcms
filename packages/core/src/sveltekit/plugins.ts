// Plugin endpoints (Decision 33, plan §17.1): `/api/plugins/<plugin>/<path>`, dispatched from the
// package API route (./api.ts). SECURITY-CRITICAL: changes need Opus review + tests.
//
// Checks, in order (each failure answers before any plugin code runs):
//   1. plugin exists, has endpoints, and its entitlement is on          → 404
//   2. a route matches the path (405 when only the method differs)      → 404 / 405
//   3. non-GET: the `Origin` header equals the request's origin         → 403
//   4. access: `public` | `signedIn` (401) | `admin` (401 / 403)
//   5. rate limit per client IP, counted in D1 (fails closed)           → 429
//   6. handler, with a body reader capped at `maxBodyBytes`             → 413
import type { RequestEvent } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import { entitled } from '../access/entitlements';
import { adminAccess } from '../access/engine';
import { consume, type AuthDb } from '../auth/rate-limit';
import type { PluginEndpointMethod, PluginRequestBody } from '../config/plugin';
import type { SanitizedPlugin } from '../config/sanitized';
import { isKitcmsError, ValidationError } from '../errors';
import { getTables } from '../schema/drizzle';
import { AUTH_TABLES } from '../schema/spec';
import type { KitcmsInternals } from './index';

type Endpoint = SanitizedPlugin['endpoints'][number];

function fail(status: number, error: string, headers: Record<string, string> = {}): Response {
	return Response.json({ error }, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

/** Matches path segments against an endpoint's segments. `null` = no match. */
export function matchSegments(pattern: string[], segs: string[]): Record<string, string> | null {
	if (pattern.length !== segs.length) return null;
	const params: Record<string, string> = Object.create(null) as Record<string, string>;
	for (const [i, p] of pattern.entries()) {
		const s = segs[i]!;
		if (p.startsWith(':')) params[p.slice(1)] = s;
		else if (p !== s) return null;
	}
	return params;
}

class BodyTooLarge extends Error {}

/** Reads the body once, refusing more than `max` bytes (declared or streamed). */
export function cappedBody(request: Request, max: number): PluginRequestBody {
	let used = false;
	const bytes = async (): Promise<Uint8Array<ArrayBuffer>> => {
		if (used) throw new Error('kitcms: the request body was already read.');
		used = true;
		const declared = Number(request.headers.get('content-length'));
		if (Number.isFinite(declared) && declared > max) throw new BodyTooLarge();
		if (!request.body) return new Uint8Array();
		const reader = request.body.getReader();
		const chunks: Uint8Array[] = [];
		let total = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > max) {
				await reader.cancel().catch(() => {});
				throw new BodyTooLarge();
			}
			chunks.push(value);
		}
		const out = new Uint8Array(total);
		let offset = 0;
		for (const c of chunks) {
			out.set(c, offset);
			offset += c.byteLength;
		}
		return out;
	};
	const text = async () => new TextDecoder().decode(await bytes());
	return {
		text,
		async json() {
			const t = await text();
			try {
				return JSON.parse(t) as unknown;
			} catch {
				throw new ValidationError([{ path: '', message: 'The body is not valid JSON.' }]);
			}
		},
		async form() {
			const b = await bytes();
			const type = request.headers.get('content-type') ?? '';
			try {
				return await new Response(b as BodyInit, { headers: { 'content-type': type } }).formData();
			} catch {
				throw new ValidationError([{ path: '', message: 'The body is not valid form data.' }]);
			}
		},
	};
}

/** Rate-limit key: plugin + route pattern + client IP (one shared bucket when the IP is unknown). */
export function rateKey(plugin: string, endpoint: Endpoint, ip: string | null): string {
	return `kitcms:plugin:${plugin}:${endpoint.method} ${endpoint.segments.join('/')}:ip:${ip ?? 'unknown'}`;
}

export async function handlePluginEndpoint(
	event: RequestEvent,
	k: KitcmsInternals,
	method: PluginEndpointMethod,
	segs: string[],
): Promise<Response> {
	const [name, ...rest] = segs;
	const plugin = k.config.plugins.find((p) => p.name === name && p.endpoints.length > 0);
	if (!plugin || !(await entitled(k.config, plugin.entitlement))) return fail(404, 'Not found.');

	let endpoint: Endpoint | undefined;
	let params: Record<string, string> | null = null;
	let methodMismatch = false;
	for (const e of plugin.endpoints) {
		const m = matchSegments(e.segments, rest);
		if (!m) continue;
		if (e.method !== method) {
			methodMismatch = true;
			continue;
		}
		endpoint = e;
		params = m;
		break;
	}
	if (!endpoint || !params)
		return methodMismatch ? fail(405, 'Method not allowed.') : fail(404, 'Not found.');

	if (method !== 'GET') {
		const origin = event.request.headers.get('origin');
		if (!origin || origin !== event.url.origin) return fail(403, 'Cross-origin request blocked.');
	}

	const user = k.user;
	if (endpoint.access !== 'public') {
		if (!user) return fail(401, 'Sign in to continue.');
		if (endpoint.access === 'admin') {
			const ok = await adminAccess(k.config, { user, context: {}, cms: k.cms, source: 'admin' });
			if (!ok) return fail(403, 'You do not have access to this endpoint.');
		}
	}

	const ip = event.request.headers.get('cf-connecting-ip');
	if (endpoint.rateLimit) {
		// FAIL CLOSED: a D1 error propagates (500) rather than letting the request through.
		const binding = k.env[k.config.bindings.db] as D1Database;
		const decision = await consume(
			drizzle(binding) as unknown as AuthDb,
			getTables(k.config)[AUTH_TABLES.rateLimit]!,
			rateKey(plugin.name, endpoint, ip),
			endpoint.rateLimit,
		);
		if (!decision.allowed) {
			return fail(429, 'Too many requests. Try again later.', {
				'retry-after': String(decision.retryAfter),
			});
		}
	}

	try {
		return await endpoint.handler({
			event,
			params,
			user,
			cms: k.cmsFor(user, 'rest'),
			body: cappedBody(event.request, endpoint.maxBodyBytes),
			email: k.email,
			runtime: k.runtime(),
			ip,
		});
	} catch (err) {
		if (err instanceof BodyTooLarge) return fail(413, 'The request body is too large.');
		if (err instanceof ValidationError) {
			return Response.json(
				{ error: err.message, errors: err.errors },
				{ status: 400, headers: { 'cache-control': 'no-store' } },
			);
		}
		if (isKitcmsError(err)) return fail(err.status, err.message);
		throw err;
	}
}
