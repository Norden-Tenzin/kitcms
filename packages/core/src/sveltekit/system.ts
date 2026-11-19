// Trusted server-to-server setup (Decision 38). SECURITY-CRITICAL.
//
// A hosting platform that provisions one deployment per customer calls these right after it uploads
// the Worker, to fill the new database without a browser:
//   POST /api/system/seed/:name   { input?: unknown }                   run `config.system.seeds[name]`
//   POST /api/system/users        { email, name, role?, invite?, origin? } create a user, email an invite
//
// Auth: `Authorization: Bearer <token>`, compared in constant time with the Worker secret
// (`config.system.secret`, default KITCMS_SYSTEM_TOKEN). Without a secret of at least 32 characters
// the endpoints don't exist (404). No cookies are involved, so there is no CSRF surface; Origin is
// not required (callers are servers). Every call is idempotent: a retried provisioning step creates
// nothing twice.
import type { RequestEvent } from '@sveltejs/kit';
import { createSeedContext, type SeedFn } from '../seed';
import { isKitcmsError, ValidationError } from '../errors';
import type { KitcmsInternals } from './index';
import { passwordLink } from './password-link';
import { adminTitle } from './title';

export const SYSTEM_TOKEN_MIN_LENGTH = 32;
const MAX_BODY = 64 * 1024;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

const enc = new TextEncoder();

/** Constant-time equality of two strings (compares SHA-256 digests, so lengths don't leak either). */
export async function tokensEqual(a: string, b: string): Promise<boolean> {
	const [da, db] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
	const x = new Uint8Array(da);
	const y = new Uint8Array(db);
	let diff = 0;
	for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
	return diff === 0;
}

/** `null` when the caller is the trusted system; otherwise the response to send. */
export async function checkSystemAuth(k: KitcmsInternals, request: Request): Promise<Response | null> {
	const secret = k.env[k.config.system.secret];
	if (typeof secret !== 'string' || secret.length < SYSTEM_TOKEN_MIN_LENGTH) return json({ error: 'Not found.' }, 404);
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
	if (!token || !(await tokensEqual(token, secret))) return json({ error: 'Unauthorized.' }, 401);
	return null;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
	if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json'))
		throw new ValidationError([{ path: '', message: 'Send application/json.' }]);
	const text = await request.text();
	if (text.length > MAX_BODY) throw new ValidationError([{ path: '', message: 'The body is too large.' }]);
	let body: unknown;
	try {
		body = text ? JSON.parse(text) : {};
	} catch {
		throw new ValidationError([{ path: '', message: 'Invalid JSON.' }]);
	}
	if (body === null || typeof body !== 'object' || Array.isArray(body))
		throw new ValidationError([{ path: '', message: 'The body must be a JSON object.' }]);
	return body as Record<string, unknown>;
}

async function runSeed(k: KitcmsInternals, name: string, body: Record<string, unknown>): Promise<Response> {
	const make = Object.hasOwn(k.config.system.seeds, name) ? k.config.system.seeds[name] : undefined;
	if (!make) return json({ error: `Unknown seed "${name}".` }, 404);
	const fn = (await make(body.input)) as SeedFn;
	if (typeof fn !== 'function') throw new Error(`kitcms: system seed "${name}" did not return a seed function.`);
	const log: string[] = [];
	const { ctx, stats } = createSeedContext(k.cmsFor(null), (m) => log.push(String(m).slice(0, 500)), {
		config: k.config,
		storage: k.storage,
	});
	await fn(ctx as never);
	return json({ ok: true, stats, log });
}

async function ensureUser(k: KitcmsInternals, event: RequestEvent, body: Record<string, unknown>): Promise<Response> {
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const role = body.role === undefined ? 'admin' : body.role;
	const invite = body.invite === undefined ? true : body.invite;
	const errors: { path: string; message: string }[] = [];
	if (!EMAIL_RE.test(email) || email.length > 254) errors.push({ path: 'email', message: 'A valid email is required.' });
	if (!name || name.length > 200) errors.push({ path: 'name', message: 'A name is required.' });
	if (typeof role !== 'string' || !role) errors.push({ path: 'role', message: 'Must be a role name.' });
	if (typeof invite !== 'boolean') errors.push({ path: 'invite', message: 'Must be true or false.' });
	// Where the invite link points (the site's public host); defaults to this request's origin.
	let linkUrl = event.url;
	if (body.origin !== undefined) {
		try {
			const u = new URL(String(body.origin));
			if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new Error('not https');
			linkUrl = new URL(u.origin);
		} catch {
			errors.push({ path: 'origin', message: 'Must be an https origin.' });
		}
	}
	if (errors.length) throw new ValidationError(errors);

	const slug = k.config.authCollection;
	const system = k.cmsFor(null);
	const { docs } = (await system.find(slug, { where: { email: { equals: email } }, limit: 1, overrideAccess: true })) as {
		docs: { id: string }[];
	};
	let id = docs[0]?.id;
	const created = !id;
	if (!id) id = ((await system.create(slug, { email, name, role }, { overrideAccess: true })) as { id: string }).id;

	let invited = false;
	if (invite) {
		const { authContext } = await import('../auth/users');
		const accounts = await (await authContext(k)).internalAdapter.findAccounts(id);
		// Someone who already set a password doesn't get another invite (a retried step must not reset them).
		if (!accounts.some((a) => a.providerId === 'credential')) {
			const { sendInvite } = await import('../auth/password-tokens');
			await sendInvite(k, id, { link: passwordLink(k, linkUrl), title: await adminTitle(k) });
			invited = true;
		}
	}
	return json({ ok: true, id, created, invited });
}

/** Serves `/api/system/*` (`segs` without the leading `system`), or `null` for another path. */
export async function handleSystem(event: RequestEvent, k: KitcmsInternals, segs: string[]): Promise<Response> {
	const denied = await checkSystemAuth(k, event.request);
	if (denied) return denied;
	try {
		if (segs[0] === 'seed' && segs[1] && segs.length === 2) return await runSeed(k, segs[1], await readJson(event.request));
		if (segs[0] === 'users' && segs.length === 1) return await ensureUser(k, event, await readJson(event.request));
		return json({ error: 'Not found.' }, 404);
	} catch (err) {
		if (err instanceof ValidationError) return json({ error: err.message, errors: err.errors }, 400);
		if (isKitcmsError(err)) return json({ error: err.message }, err.status);
		throw err;
	}
}
