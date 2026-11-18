import { expect, test, type APIRequestContext } from '@playwright/test';
import { KitcmsClientError, isKitcmsClientError, parseKitcmsError } from '@kitcms/client';
import { CONSUMER_URL } from '../constants';
import { uid } from './helpers';

// RPC contract tests. The headless consumer (apps/playground-consumer, `wrangler dev`, bound to the CMS
// over Service Binding RPC) proxies `POST /e2e/call { method, args }` to the typed `@kitcms/client`
// and returns the result or the parsed `KitcmsClientError`. Only enabled with the `E2E=1` var.
test.describe.configure({ mode: 'serial' });

interface Ok<T = unknown> {
	ok: true;
	result: T;
}
interface Failed {
	ok: false;
	clientError: boolean;
	code?: string;
	status?: number;
	message: string;
	name?: string;
}
type Reply<T = unknown> = Ok<T> | Failed;

async function call<T = unknown>(
	request: APIRequestContext,
	method: string,
	...args: unknown[]
): Promise<Reply<T>> {
	const res = await request.post(`${CONSUMER_URL}/e2e/call`, { data: { method, args } });
	expect(res.ok(), `${method} reached the consumer`).toBe(true);
	return (await res.json()) as Reply<T>;
}

function ok<T>(reply: Reply<T>): T {
	if (!reply.ok) throw new Error(`expected success, got ${reply.code}: ${reply.message}`);
	return reply.result;
}

interface Docs {
	docs: { id: string; title: string; _status?: string }[];
	totalDocs: number;
}

const SYSTEM = { as: 'system' };

test('anonymous find returns published documents only', async ({ request }) => {
	const published = uid('rpc published');
	const draft = uid('rpc draft');
	const pub = ok(
		await call<{ id: string }>(request, 'create', 'pages', { title: published }, SYSTEM),
	);
	const dr = ok(
		await call<{ id: string }>(
			request,
			'create',
			'pages',
			{ title: draft },
			{ as: 'system', draft: true },
		),
	);

	const found = ok(await call<Docs>(request, 'find', 'pages', { limit: 1000 }));
	const titles = found.docs.map((d) => d.title);
	expect(titles).toContain(published);
	expect(titles).not.toContain(draft);
	expect(found.docs.every((d) => d._status === undefined || d._status === 'published')).toBe(true);

	// By id: the draft is invisible to an anonymous caller, visible to a trusted one.
	expect(ok(await call(request, 'findByID', 'pages', dr.id))).toBeNull();
	expect(
		ok(
			await call<{ title: string }>(request, 'findByID', 'pages', dr.id, {
				as: 'system',
				draft: true,
			}),
		)?.title,
	).toBe(draft);

	// A system find with `draft: true` includes drafts.
	const all = ok(
		await call<Docs>(request, 'find', 'pages', { as: 'system', draft: true, limit: 1000 }),
	);
	expect(all.docs.map((d) => d.title)).toEqual(expect.arrayContaining([published, draft]));

	for (const id of [pub.id, dr.id]) ok(await call(request, 'delete', 'pages', id, SYSTEM));
});

test('anonymous writes are FORBIDDEN', async ({ request }) => {
	const create = await call(request, 'create', 'pages', { title: 'nope' }, {});
	expect(create).toMatchObject({ ok: false, clientError: true, code: 'FORBIDDEN', status: 403 });

	const seed = ok(
		await call<{ id: string }>(request, 'create', 'pages', { title: uid('rpc target') }, SYSTEM),
	);
	expect(await call(request, 'update', 'pages', seed.id, { title: 'hijacked' }, {})).toMatchObject({
		ok: false,
		code: 'FORBIDDEN',
	});
	expect(await call(request, 'delete', 'pages', seed.id, {})).toMatchObject({
		ok: false,
		code: 'FORBIDDEN',
	});
	expect(await call(request, 'unpublish', 'pages', seed.id, {})).toMatchObject({
		ok: false,
		code: 'FORBIDDEN',
	});
	expect(await call(request, 'updateGlobal', 'site', { siteName: 'hijacked' }, {})).toMatchObject({
		ok: false,
		code: 'FORBIDDEN',
	});

	// Nothing changed.
	const still = ok(await call<{ title: string } | null>(request, 'findByID', 'pages', seed.id));
	expect(still?.title).not.toBe('hijacked');
	ok(await call(request, 'delete', 'pages', seed.id, SYSTEM));
});

test('an anonymous draft read is FORBIDDEN', async ({ request }) => {
	expect(await call(request, 'find', 'pages', { draft: true })).toMatchObject({
		ok: false,
		clientError: true,
		code: 'FORBIDDEN',
		status: 403,
	});
	expect(await call(request, 'findByID', 'pages', 'whatever', { draft: true })).toMatchObject({
		ok: false,
		code: 'FORBIDDEN',
	});
});

test('as: system can create, update and delete', async ({ request }) => {
	const t = uid('rpc system');
	const created = ok(
		await call<{ id: string; title: string }>(request, 'create', 'pages', { title: t }, SYSTEM),
	);
	expect(created.title).toBe(t);
	expect(
		ok(await call<{ title: string } | null>(request, 'findByID', 'pages', created.id))?.title,
	).toBe(t);

	const updated = ok(
		await call<{ title: string }>(
			request,
			'update',
			'pages',
			created.id,
			{ title: `${t}!` },
			SYSTEM,
		),
	);
	expect(updated.title).toBe(`${t}!`);

	ok(await call(request, 'delete', 'pages', created.id, SYSTEM));
	expect(ok(await call(request, 'findByID', 'pages', created.id))).toBeNull();
	expect(
		ok(await call(request, 'findByID', 'pages', created.id, { as: 'system', draft: true })),
	).toBeNull();
});

test('errors cross the binding as KitcmsClientError with code and status', async ({ request }) => {
	const bad = await call(request, 'find', 'pages', { where: { nope: { equals: 1 } } });
	expect(bad).toMatchObject({
		ok: false,
		clientError: true,
		name: 'KitcmsClientError',
		code: 'QUERY',
		status: 400,
	});
	expect((bad as Failed).message).not.toMatch(/^kitcms:/);

	const missing = await call(request, 'find', 'no-such-collection', {});
	expect(missing).toMatchObject({ ok: false, clientError: true });
	expect((missing as Failed).status).toBeGreaterThanOrEqual(400);
	expect((missing as Failed).code).toMatch(/^[A-Z_]+$/);
});

test('the wire format parses into KitcmsClientError (client unit check)', () => {
	const err = parseKitcmsError(
		new Error('Uncaught Error: kitcms:FORBIDDEN:403: You are not allowed.'),
	);
	expect(isKitcmsClientError(err)).toBe(true);
	expect(err).toBeInstanceOf(KitcmsClientError);
	expect(err).toMatchObject({ code: 'FORBIDDEN', status: 403, message: 'You are not allowed.' });
	// Anything else passes through untouched.
	const other = new Error('boom');
	expect(parseKitcmsError(other)).toBe(other);
});

test('unknown options such as `tenant` are rejected, not ignored', async ({ request }) => {
	expect(await call(request, 'find', 'pages', { tenant: 'x' })).toMatchObject({
		ok: false,
		clientError: true,
		code: 'QUERY',
		status: 400,
	});
	expect(
		await call(request, 'delete', 'pages', 'nope', { as: 'system', tenant: 'x' }),
	).toMatchObject({ ok: false, code: 'QUERY' });
});
