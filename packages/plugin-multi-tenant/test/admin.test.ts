// Admin tenant switcher (plan §15.3): the `tenancy` block of `load` and the `setTenant` action.
// Real pipeline on Miniflare D1; `getKitcms` is mocked (same harness as isolation.test.ts).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let current: unknown;
vi.mock('cloudflare:workers', () => ({ WorkerEntrypoint: class {}, env: {}, waitUntil: undefined }));
vi.mock('$app/env', () => ({ dev: true, building: false }));
vi.mock('$app/paths', () => ({ base: '', resolve: (_id: string, p?: { path?: string }) => `/admin/${p?.path ?? ''}` }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('no request event');
	},
}));
vi.mock('../../core/src/sveltekit/index', () => ({ getKitcms: () => current }));

import type { RequestEvent } from '@sveltejs/kit';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { createSchemaStatements } from '../../core/test/d1';
import { createLocalApi } from '../../core/src/api/local';
import { collection, defineConfig } from '../../core/src/config/collection';
import { fields as f } from '../../core/src/config/fields';
import type { KitcmsUser } from '../../core/src/config/hooks';
import { sanitizeConfig } from '../../core/src/config/sanitize';
import { createD1Adapter } from '../../core/src/db/d1';
import type { KitcmsInternals } from '../../core/src/sveltekit/index';
import { multiTenant } from '../src/index';

const rawConfig = defineConfig({
	plugins: [multiTenant({ tenantsCollection: 'vendors', collections: ['rooms'], cacheTtl: 0 })],
	collections: [
		collection({
			slug: 'vendors',
			access: { read: () => true },
			admin: { useAsTitle: 'name' },
			fields: { name: f.text({ required: true }), slug: f.text({ unique: true }) },
		}),
		collection({
			slug: 'users',
			auth: true,
			fields: { role: f.select({ options: ['admin', 'editor'], defaultValue: 'editor' }) },
		}),
		collection({ slug: 'rooms', access: { read: () => true }, fields: { name: f.text({ required: true }) } }),
	],
});
const config = sanitizeConfig(rawConfig);

const ORIGIN = 'http://localhost:5173';
let mf: Miniflare;
let d1: D1Database;
const ids = {} as Record<'A' | 'B', string>;
const users = {} as Record<'admin' | 'alice' | 'multi', KitcmsUser>;

function internalsFor(user: KitcmsUser, tenant: string | null): KitcmsInternals {
	const db = createD1Adapter(config, d1);
	const cmsFor = (u: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') =>
		createLocalApi({ config, db, user: u, source, tenant });
	return { config, options: { config: rawConfig }, db, env: {}, cms: cmsFor(user), user, cmsFor, tenant, hostTenant: null } as unknown as KitcmsInternals;
}

beforeAll(async () => {
	mf = new Miniflare(
		convertV4MiniflareOptions({
			modules: true,
			script: 'export default { fetch() { return new Response() } }',
			d1Databases: ['DB'],
		}),
	);
	d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
	for (const stmt of await createSchemaStatements(config)) {
		for (const part of stmt.split('--> statement-breakpoint')) if (part.trim()) await d1.prepare(part.trim()).run();
	}
	const sys = createLocalApi({ config, db: createD1Adapter(config, d1), user: null, source: 'local', tenant: null });
	const create = (c: string, data: Record<string, unknown>) =>
		(sys.create as (c: string, d: unknown, o: unknown) => Promise<{ id: string }>)(c, data, { overrideAccess: true });
	ids.A = (await create('vendors', { name: 'Vendor A', slug: 'a' })).id;
	ids.B = (await create('vendors', { name: 'Vendor B', slug: 'b' })).id;
	const mk = async (name: keyof typeof users, role: string, tenants: string[]) => {
		const doc = await create('users', { email: `${name}@x.io`, name, role, tenants });
		users[name] = { id: doc.id, email: `${name}@x.io`, name, role, collection: 'users', tenants };
	};
	await mk('admin', 'admin', []);
	await mk('alice', 'editor', [ids.A]);
	await mk('multi', 'editor', [ids.A, ids.B]);
});
afterAll(async () => {
	await mf.dispose();
});

type CookieCall = { name: string; value: string; opts: Record<string, unknown> };
function event(path: string, init: { origin?: string | null; body?: Record<string, string> } = {}) {
	const calls: CookieCall[] = [];
	const headers = new Headers();
	if (init.origin !== null) headers.set('origin', init.origin ?? ORIGIN);
	const fd = new FormData();
	for (const [k, v] of Object.entries(init.body ?? {})) fd.set(k, v);
	const url = new URL(`/admin/${path}`, ORIGIN);
	const e = {
		request: new Request(url, { method: 'POST', headers, body: fd }),
		url,
		params: { path },
		locals: {},
		cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => calls.push({ name, value, opts }) },
	} as unknown as RequestEvent;
	return { e, calls };
}

let admin: typeof import('../../core/src/sveltekit/admin');
beforeAll(async () => {
	admin = await import('../../core/src/sveltekit/admin');
});
const setTenant = async (e: RequestEvent) => {
	try {
		return { result: (await admin.actions.setTenant!(e)) as { status?: number; data?: { message?: string } } | undefined };
	} catch (thrown) {
		return { thrown: thrown as { status: number; location?: string } };
	}
};

describe('load: tenancy block', () => {
	const load = async (user: KitcmsUser, tenant: string | null) => {
		current = internalsFor(user, tenant);
		const { e } = event('', { body: {} });
		return (await admin.load(e)) as unknown as { tenancy: Record<string, unknown> | null };
	};

	it('an "all" user: every tenant, canSelectAll, no current tenant', async () => {
		const { tenancy } = await load(users.admin, null);
		expect(tenancy).toMatchObject({ current: null, field: 'tenant', scoped: ['rooms'], canSelectAll: true });
		expect((tenancy!.tenants as { id: string; title: string }[]).sort((a, b) => a.title.localeCompare(b.title))).toEqual([
			{ id: ids.A, title: 'Vendor A' },
			{ id: ids.B, title: 'Vendor B' },
		]);
	});

	it('a tenant user: only their tenant, cannot select all', async () => {
		const { tenancy } = await load(users.alice, ids.A);
		expect(tenancy).toEqual({
			current: ids.A,
			field: 'tenant',
			scoped: ['rooms'],
			tenants: [{ id: ids.A, title: 'Vendor A' }],
			canSelectAll: false,
		});
	});
});

describe('setTenant', () => {
	it('rejects a missing or foreign Origin before anything else', async () => {
		current = internalsFor(users.alice, ids.A);
		expect((await setTenant(event('', { origin: null, body: { tenant: ids.A } }).e)).thrown?.status).toBe(403);
		const foreign = event('', { origin: 'https://evil.example', body: { tenant: ids.A } });
		expect((await setTenant(foreign.e)).thrown?.status).toBe(403);
		expect(foreign.calls).toEqual([]);
	});

	it('a tenant user cannot select a tenant they do not belong to', async () => {
		current = internalsFor(users.alice, ids.A);
		const ev = event('', { body: { tenant: ids.B } });
		const out = await setTenant(ev.e);
		expect(out.result).toMatchObject({ status: 403, data: { message: 'You cannot work on that tenant.' } });
		expect(ev.calls).toEqual([]);
	});

	it('a tenant user cannot select "all tenants"', async () => {
		current = internalsFor(users.alice, ids.A);
		const ev = event('', { body: { tenant: '' } });
		expect((await setTenant(ev.e)).result).toMatchObject({ status: 403 });
		expect(ev.calls).toEqual([]);
	});

	it('rejects garbage values', async () => {
		current = internalsFor(users.admin, null);
		const ev = event('', { body: { tenant: 'a; Path=/' } });
		expect((await setTenant(ev.e)).result).toMatchObject({ status: 403 });
		expect(ev.calls).toEqual([]);
	});

	it('an "all" user may select all tenants: cookie "" and 303', async () => {
		current = internalsFor(users.admin, ids.A);
		const ev = event('', { body: { tenant: '' } });
		const out = await setTenant(ev.e);
		expect(out.thrown).toMatchObject({ status: 303 });
		expect(ev.calls).toHaveLength(1);
		expect(ev.calls[0]).toMatchObject({ name: 'kitcms-tenant', value: '' });
	});

	it('a valid selection sets the cookie with the right attributes and redirects', async () => {
		current = internalsFor(users.multi, ids.A);
		const ev = event('', { body: { tenant: ids.B } });
		const out = await setTenant(ev.e);
		expect(out.thrown).toMatchObject({ status: 303 });
		expect(ev.calls[0]).toMatchObject({
			name: 'kitcms-tenant',
			value: ids.B,
			opts: { httpOnly: true, sameSite: 'lax', maxAge: 31536000, secure: false },
		});
		expect(String(ev.calls[0]!.opts.path).endsWith('/')).toBe(true);
	});
});
