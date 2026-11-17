// Tenant ISOLATION suite (plan §8, §15.2). SECURITY-CRITICAL, written by Opus. Every test tries
// to reach another tenant's data (or move data across tenants) through the Local API, RPC, REST,
// admin actions or uploads, and must fail. Real pipeline on Miniflare D1 (+ R2 for uploads).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let current: unknown;
const events: { current: unknown } = { current: undefined };
vi.mock('cloudflare:workers', () => ({ WorkerEntrypoint: class {}, env: {}, waitUntil: undefined }));
vi.mock('$app/env', () => ({ dev: true, building: false }));
vi.mock('$app/paths', () => ({ base: '', resolve: (_id: string, p?: { path?: string }) => `/admin/${p?.path ?? ''}` }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		if (!events.current) throw new Error('no request event');
		return events.current;
	},
}));
vi.mock('../../core/src/sveltekit/index', () => ({ getKitcms: () => current }));

import type { RequestEvent } from '@sveltejs/kit';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { createSchemaStatements } from '../../core/test/d1';
import { requestTenant, storagePrefixFor, tenantScope } from '../../core/src/access/tenancy';
import { createLocalApi } from '../../core/src/api/local';
import { withEdgeCache } from '../../core/src/api/cache';
import type { Cms } from '../../core/src/api/types';
import { block, collection, defineConfig, global } from '../../core/src/config/collection';
import { fields as f } from '../../core/src/config/fields';
import type { KitcmsUser } from '../../core/src/config/hooks';
import { sanitizeConfig } from '../../core/src/config/sanitize';
import { createD1Adapter } from '../../core/src/db/d1';
import { toTableSpecs } from '../../core/src/schema/tables';
import { createKitcmsRPC } from '../../core/src/rpc/index';
import { createR2Adapter } from '../../core/src/storage/r2';
import { handleUpload } from '../../core/src/upload/handler';
import type { KitcmsInternals } from '../../core/src/sveltekit/index';
import { readTenantCookie, serializeTenantCookie } from '../../core/src/sveltekit/tenant';
import { multiTenant, tenantByHost } from '../src/index';

// ---------------------------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------------------------

const Gallery = block({ slug: 'gallery', fields: { image: f.upload({ relationTo: 'media' }) } });

const rawConfig = defineConfig({
	plugins: [
		multiTenant({
			tenantsCollection: 'vendors',
			collections: ['pages', 'media'],
			resolveTenant: tenantByHost({
				collection: 'vendors',
				domainField: 'domain',
				subdomain: { field: 'slug', rootDomain: 'example.com' },
			}),
			cacheTtl: 0,
		}),
	],
	collections: [
		collection({
			slug: 'vendors',
			access: { read: () => true },
			fields: { name: f.text({ required: true }), slug: f.text({ unique: true }), domain: f.text() },
		}),
		collection({
			slug: 'users',
			auth: true,
			fields: { role: f.select({ options: ['admin', 'editor'], defaultValue: 'editor' }) },
		}),
		collection({
			slug: 'pages',
			orderable: true,
			versions: { drafts: true },
			access: { read: () => true },
			hooks: {
				beforeChange: ({ data, req }) =>
					typeof req.context.evilTenant === 'string' ? { ...data, tenant: req.context.evilTenant } : data,
			},
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true }),
				cover: f.upload({ relationTo: 'media' }),
				related: f.relationship({ relationTo: 'pages', hasMany: true }),
				sections: f.blocks({ blocks: [Gallery] }),
			},
		}),
		collection({ slug: 'media', upload: true, access: { read: () => true }, fields: { alt: f.text() } }),
		collection({
			slug: 'tags',
			access: { read: () => true },
			fields: { name: f.text(), featured: f.relationship({ relationTo: 'pages' }) },
		}),
	],
	globals: [global({ slug: 'site', access: { read: () => true }, fields: { name: f.text() } })],
});
const config = sanitizeConfig(rawConfig);

// ---------------------------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------------------------

let mf: Miniflare;
let d1: D1Database;
let bucket: R2Bucket;
const ids = {} as Record<'A' | 'B' | 'mA' | 'mB' | 'pA' | 'pA2' | 'pB', string>;
const users: Record<'admin' | 'alice' | 'bob' | 'multi' | 'nobody', KitcmsUser> = {} as never;

function cmsAs(user: KitcmsUser | null, tenant: string | null, source: 'local' | 'admin' | 'rest' | 'rpc' = 'local'): Cms {
	return createLocalApi({ config, db: createD1Adapter(config, d1), user, source, tenant });
}
const system = (tenant: string | null = null) => {
	const cms = cmsAs(null, tenant);
	return new Proxy(cms, {
		get(t, p) {
			const fn = Reflect.get(t, p) as (...a: unknown[]) => unknown;
			if (typeof fn !== 'function') return fn;
			return (...a: unknown[]) => {
				// Append overrideAccess to the options argument (last position used by each method).
				const at = { find: 1, findOne: 1, count: 1, findByID: 2, create: 2, update: 3, delete: 2, move: 3 }[p as string] ?? a.length;
				const args = [...a];
				args[at] = { ...(args[at] as object | undefined), overrideAccess: true };
				return fn.apply(t, args);
			};
		},
	}) as Cms;
};
type Doc = Record<string, unknown> & { id: string };

function internalsFor(user: KitcmsUser | null, tenant: string | null): KitcmsInternals {
	const db = createD1Adapter(config, d1);
	const storage = createR2Adapter(bucket, { base: () => '' });
	const cmsFor = (u: KitcmsUser | null, source: 'local' | 'admin' | 'rest' = 'local') =>
		createLocalApi({ config, db, storage, user: u, source, tenant });
	return {
		config,
		options: { config: rawConfig },
		db,
		env: { DB: d1, BUCKET: bucket },
		cms: cmsFor(user),
		user,
		cmsFor,
		storage,
		tenant,
		hostTenant: null,
	};
}

beforeAll(async () => {
	mf = new Miniflare(
		convertV4MiniflareOptions({
			modules: true,
			script: 'export default { fetch() { return new Response() } }',
			d1Databases: ['DB'],
			r2Buckets: ['BUCKET'],
		}),
	);
	d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
	bucket = (await mf.getR2Bucket('BUCKET')) as unknown as R2Bucket;
	for (const stmt of await createSchemaStatements(config)) {
		for (const part of stmt.split('--> statement-breakpoint')) if (part.trim()) await d1.prepare(part.trim()).run();
	}

	const sys = system();
	ids.A = ((await sys.create('vendors', { name: 'A', slug: 'a', domain: 'hotel-a.test' })) as Doc).id;
	ids.B = ((await sys.create('vendors', { name: 'B', slug: 'b' })) as Doc).id;

	const mk = async (name: keyof typeof users, role: string, tenants: string[]) => {
		const doc = (await sys.create('users', { email: `${name}@x.io`, name, role, tenants })) as Doc;
		users[name] = { id: doc.id, email: `${name}@x.io`, name, role, collection: 'users', tenants };
	};
	await mk('admin', 'admin', []);
	await mk('alice', 'editor', [ids.A]);
	await mk('bob', 'editor', [ids.B]);
	await mk('multi', 'editor', [ids.A, ids.B]);
	await mk('nobody', 'editor', []);

	const media = (key: string) => ({ filename: 'x.png', mimeType: 'image/png', filesize: 1, key });
	ids.mA = ((await sys.create('media', { ...media('a/1.png'), tenant: ids.A })) as Doc).id;
	ids.mB = ((await sys.create('media', { ...media('b/1.png'), tenant: ids.B })) as Doc).id;
	ids.pA = ((await sys.create('pages', { title: 'Home', slug: 'home', tenant: ids.A, cover: ids.mA })) as Doc).id;
	ids.pA2 = ((await sys.create('pages', { title: 'About', tenant: ids.A })) as Doc).id;
	ids.pB = ((await sys.create('pages', { title: 'Home', slug: 'home', tenant: ids.B, cover: ids.mB })) as Doc).id;
	// A draft on B's page, so B has a version row.
	await system(ids.B).update('pages', ids.pB, { title: 'B draft' }, { draft: true } as never);
});
afterAll(async () => {
	await mf.dispose();
});

const tenantsOf = (r: { docs: Record<string, unknown>[] }) => [...new Set(r.docs.map((d) => d.tenant))];

// ---------------------------------------------------------------------------------------------
// Config / schema
// ---------------------------------------------------------------------------------------------

describe('plugin config', () => {
	it('adds the tenant field, the users field and per-tenant unique indexes', () => {
		const pages = config.collectionsBySlug.pages!;
		expect(pages.fields.find((x) => x.name === 'tenant')).toMatchObject({ type: 'relationship', relationTo: 'vendors', required: true });
		expect(pages.fields.find((x) => x.name === 'slug')).toMatchObject({ unique: false });
		expect(pages.indexes).toEqual([{ fields: ['tenant', 'slug'], unique: true }]);
		expect(config.collectionsBySlug.users!.fields.find((x) => x.name === 'tenants')).toMatchObject({ hasMany: true, relationTo: 'vendors' });
		const spec = toTableSpecs(config).find((t) => t.name === 'pages')!;
		expect(spec.indexes).toContainEqual({ name: 'pages_by_tenant_slug_unique', columns: ['tenant', 'slug'], unique: true });
		expect(spec.indexes.find((i) => i.name === 'pages_slug_unique')).toBeUndefined();
		// Unscoped collections keep their global unique index.
		expect(config.collectionsBySlug.vendors!.fields.find((x) => x.name === 'slug')).toMatchObject({ unique: true });
	});

	it('does not mutate the input config', () => {
		const pages = rawConfig.collections.find((c) => c.slug === 'pages')!;
		expect(Object.keys(pages.fields)).not.toContain('tenant');
		expect((pages.fields as Record<string, { unique?: boolean }>).slug!.unique).toBe(true);
	});

	it('rejects unsafe tenancy shapes', () => {
		const base = { collections: [collection({ slug: 'vendors', fields: {} }), collection({ slug: 'pages', fields: {} })] };
		expect(() => sanitizeConfig(defineConfig({ ...base, plugins: [multiTenant({ tenantsCollection: 'nope', collections: ['pages'] })] }))).toThrow(/tenantsCollection/);
		expect(() => sanitizeConfig(defineConfig({ ...base, plugins: [multiTenant({ tenantsCollection: 'vendors', collections: ['vendors'] })] }))).toThrow(/cannot be tenant-scoped/);
		expect(() => sanitizeConfig(defineConfig({ ...base, plugins: [multiTenant({ tenantsCollection: 'vendors', collections: ['users'] })] }))).toThrow();
		// A scoped collection whose tenant field isn't a required relationship to the tenants.
		expect(() =>
			sanitizeConfig(
				defineConfig({
					collections: [collection({ slug: 'vendors', fields: {} }), collection({ slug: 'pages', fields: { tenant: f.text() } })],
					plugins: [multiTenant({ tenantsCollection: 'vendors', collections: ['pages'] })],
				}),
			),
		).toThrow(/must be a required relationship/);
	});
});

// ---------------------------------------------------------------------------------------------
// Local API
// ---------------------------------------------------------------------------------------------

describe('Local API: reads are scoped', () => {
	it('a tenant user sees only their tenant', async () => {
		const cms = cmsAs(users.alice, ids.A);
		const r = await cms.find('pages', { limit: 100 });
		expect(tenantsOf(r)).toEqual([ids.A]);
		expect(await cms.findByID('pages', ids.pB)).toBeNull();
		expect(await cms.count('pages')).toBe(2);
		expect(await cms.findOne('pages', { where: { slug: { equals: 'home' } } })).toMatchObject({ id: ids.pA });
		// A caller `where` can't widen it.
		const wide = await cms.find('pages', { where: { or: [{ tenant: { equals: ids.B } }, { id: { equals: ids.pB } }] } });
		expect(wide.docs).toEqual([]);
	});

	it('a user acting on a tenant they do not belong to is denied (defense in depth)', async () => {
		await expect(cmsAs(users.alice, ids.B).find('pages')).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(cmsAs(users.nobody, ids.A).find('pages')).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('no tenant: denied to everyone except trusted code and "all" users', async () => {
		await expect(cmsAs(users.alice, null).find('pages')).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(cmsAs(null, null).find('pages')).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(cmsAs(null, null).findByID('pages', ids.pA)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(tenantsOf(await cmsAs(users.admin, null).find('pages', { limit: 100 })).sort()).toEqual([ids.A, ids.B].sort());
		expect(tenantsOf(await system().find('pages', { limit: 100 })).sort()).toEqual([ids.A, ids.B].sort());
	});

	it('anonymous visitors see the request tenant only', async () => {
		const r = await cmsAs(null, ids.B).find('pages', { limit: 100 });
		expect(tenantsOf(r)).toEqual([ids.B]);
		expect(await cmsAs(null, ids.B).findByID('pages', ids.pA)).toBeNull();
	});

	it('an "all" user with a selected tenant and trusted code with a tenant are scoped too', async () => {
		expect(tenantsOf(await cmsAs(users.admin, ids.B).find('pages', { limit: 100 }))).toEqual([ids.B]);
		expect(tenantsOf(await system(ids.A).find('pages', { limit: 100 }))).toEqual([ids.A]);
		expect(await system(ids.A).findByID('pages', ids.pB)).toBeNull();
	});

	it('a multi-tenant user sees the selected tenant only', async () => {
		expect(tenantsOf(await cmsAs(users.multi, ids.B).find('pages', { limit: 100 }))).toEqual([ids.B]);
	});

	it('populate never crosses tenants, even for a stored foreign id', async () => {
		// Plant a cross-tenant reference behind the pipeline's back.
		await d1.prepare('UPDATE pages SET cover = ? WHERE id = ?').bind(ids.mB, ids.pA2).run();
		const doc = (await cmsAs(users.alice, ids.A).findByID('pages', ids.pA2, { depth: 1 })) as Doc;
		expect(doc.cover).toBe(ids.mB); // left as an id, not populated
		const own = (await cmsAs(users.alice, ids.A).findByID('pages', ids.pA, { depth: 1 })) as Doc;
		expect(own.cover).toMatchObject({ id: ids.mA });
		await d1.prepare('UPDATE pages SET cover = NULL WHERE id = ?').bind(ids.pA2).run();
	});

	it('drafts and versions of another tenant are unreachable', async () => {
		const sysB = system(ids.B);
		const versions = await sysB.findVersions('pages', ids.pB);
		expect(versions.docs.length).toBeGreaterThan(0);
		const vId = versions.docs[0]!.id as string;
		const alice = cmsAs(users.alice, ids.A);
		await expect(alice.findVersions('pages', ids.pB)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect(await alice.findVersionByID('pages', vId)).toBeNull();
		await expect(alice.restoreVersion('pages', vId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect(await alice.findByID('pages', ids.pB, { draft: true })).toBeNull();
		expect(await system(ids.A).findVersionByID('pages', vId)).toBeNull();
	});
});

describe('Local API: writes are scoped', () => {
	it('update, delete, move and unpublish of another tenant’s doc are NOT_FOUND', async () => {
		const alice = cmsAs(users.alice, ids.A);
		await expect(alice.update('pages', ids.pB, { title: 'pwned' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(alice.delete('pages', ids.pB)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(alice.unpublish('pages', ids.pB)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(alice.move('pages', ids.pB, { before: ids.pA })).rejects.toMatchObject({ code: 'NOT_FOUND' });
		// Moving your own doc relative to a foreign one doesn't reveal it either.
		await expect(alice.move('pages', ids.pA, { before: ids.pB })).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(system(ids.A).update('pages', ids.pB, { title: 'pwned' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect((await system().findByID('pages', ids.pB, { draft: true }) as Doc).title).toBe('B draft');
	});

	it('create forces the request tenant, whatever the input says', async () => {
		const doc = (await cmsAs(users.alice, ids.A).create('pages', { title: 'Sneaky', tenant: ids.B })) as Doc;
		expect(doc.tenant).toBe(ids.A);
		const sys = (await system(ids.A).create('pages', { title: 'Sys', tenant: ids.B })) as Doc;
		expect(sys.tenant).toBe(ids.A);
	});

	it('update cannot move a doc to another tenant, not even from a hook', async () => {
		const alice = cmsAs(users.alice, ids.A);
		const doc = (await alice.update('pages', ids.pA2, { tenant: ids.B, title: 'About us' })) as Doc;
		expect(doc.tenant).toBe(ids.A);
		const hooked = (await alice.update('pages', ids.pA2, { title: 'About' }, { context: { evilTenant: ids.B } })) as Doc;
		expect(hooked.tenant).toBe(ids.A);
		const created = (await alice.create('pages', { title: 'Hooked' }, { context: { evilTenant: ids.B } })) as Doc;
		expect(created.tenant).toBe(ids.A);
	});

	it('"all" users and trusted code without a tenant must name one; they may', async () => {
		await expect(cmsAs(users.admin, null).create('pages', { title: 'No tenant' })).rejects.toMatchObject({ code: 'VALIDATION' });
		const doc = (await cmsAs(users.admin, null).create('pages', { title: 'For B', tenant: ids.B })) as Doc;
		expect(doc.tenant).toBe(ids.B);
		await expect(cmsAs(users.alice, null).create('pages', { title: 'x', tenant: ids.A })).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(cmsAs(null, null).create('pages', { title: 'x', tenant: ids.A })).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('unique fields are unique per tenant', async () => {
		const alice = cmsAs(users.alice, ids.A);
		await expect(alice.create('pages', { title: 'Dup', slug: 'home' })).rejects.toMatchObject({
			code: 'VALIDATION',
			errors: [{ path: 'slug', message: 'Must be unique' }],
		});
		// B already has 'home' too; a third tenant-free check: B can reuse A's other slugs.
		const b = (await cmsAs(users.bob, ids.B).create('pages', { title: 'About' })) as Doc;
		expect(b.slug).toBe('about');
	});

	it('references to another tenant’s documents are rejected (top level, hasMany, blocks, unscoped source)', async () => {
		const alice = cmsAs(users.alice, ids.A);
		const notFound = (path: string) => ({ code: 'VALIDATION', errors: [{ path, message: 'Not found' }] });
		await expect(alice.create('pages', { title: 'x1', cover: ids.mB })).rejects.toMatchObject(notFound('cover'));
		await expect(alice.create('pages', { title: 'x2', related: [ids.pA, ids.pB] })).rejects.toMatchObject(notFound('related'));
		await expect(
			alice.create('pages', { title: 'x3', sections: [{ blockType: 'gallery', image: ids.mB }] }),
		).rejects.toMatchObject(notFound('sections.0.image'));
		await expect(alice.update('pages', ids.pA, { cover: ids.mB })).rejects.toMatchObject(notFound('cover'));
		await expect(alice.create('tags', { name: 't', featured: ids.pB })).rejects.toMatchObject(notFound('featured'));
		// Same id shape, own tenant: fine.
		const ok = (await alice.create('pages', { title: 'x4', cover: ids.mA, related: [ids.pA] })) as Doc;
		expect(ok.cover).toBe(ids.mA);
		expect(((await alice.create('tags', { name: 't', featured: ids.pA })) as Doc).featured).toBe(ids.pA);
		// Trusted code is checked against the document's tenant too.
		await expect(system().create('pages', { title: 'x5', tenant: ids.A, cover: ids.mB })).rejects.toMatchObject(notFound('cover'));
		// An "all" user writing for B can't attach A's media either.
		await expect(cmsAs(users.admin, null).create('pages', { title: 'x6', tenant: ids.B, cover: ids.mA })).rejects.toMatchObject(notFound('cover'));
	});

	it('delete protection only ever reports same-tenant references', async () => {
		await expect(cmsAs(users.bob, ids.B).delete('media', ids.mB)).rejects.toMatchObject({ code: 'REFERENCED' });
		await expect(cmsAs(users.bob, ids.B).delete('media', ids.mA)).rejects.toMatchObject({ code: 'NOT_FOUND' });
	});
});

describe('Local API: the tenants and users collections', () => {
	it('tenant users see and edit only their own tenants; only "all" users create/delete them', async () => {
		const alice = cmsAs(users.alice, ids.A);
		expect((await alice.find('vendors')).docs.map((d) => d.id)).toEqual([ids.A]);
		await expect(alice.update('vendors', ids.B, { name: 'pwned' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(alice.create('vendors', { name: 'C' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(alice.delete('vendors', ids.B)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect((await cmsAs(users.nobody, null).find('vendors')).docs).toEqual([]);
		// Anonymous: the collection's own (public) rule.
		expect((await cmsAs(null, null).find('vendors')).totalDocs).toBe(2);
		expect((await cmsAs(users.admin, null).find('vendors')).totalDocs).toBe(2);
	});

	it('tenant users see themselves and the users of the current tenant only', async () => {
		const names = async (u: KitcmsUser, t: string | null) =>
			(await cmsAs(u, t).find('users', { limit: 100 })).docs.map((d) => d.name).sort();
		expect(await names(users.alice, ids.A)).toEqual(['alice', 'multi']);
		expect(await names(users.bob, ids.B)).toEqual(['bob', 'multi']);
		expect(await names(users.nobody, null)).toEqual(['nobody']);
		expect((await names(users.admin, null)).length).toBe(5);
	});

	it('users cannot add themselves to tenants or edit other users', async () => {
		const alice = cmsAs(users.alice, ids.A);
		const me = (await alice.update('users', users.alice.id, { tenants: [ids.A, ids.B], name: 'alice' })) as Doc;
		expect(me.tenants).toEqual([ids.A]);
		await expect(alice.update('users', users.multi.id, { name: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
		const byAdmin = (await cmsAs(users.admin, null).update('users', users.nobody.id, { tenants: [ids.B] })) as Doc;
		expect(byAdmin.tenants).toEqual([ids.B]);
		await cmsAs(users.admin, null).update('users', users.nobody.id, { tenants: [] });
	});
});

// ---------------------------------------------------------------------------------------------
// Request tenant, cookie, prefix, cache
// ---------------------------------------------------------------------------------------------

describe('request tenant resolution', () => {
	const t = config.tenancy as Exclude<typeof config.tenancy, false>;
	it('anonymous → host; signed in → valid cookie, else host if member, else first tenant', () => {
		expect(requestTenant(t, null, 'h', 'c')).toBe('h');
		expect(requestTenant(t, users.alice, null, ids.A)).toBe(ids.A);
		expect(requestTenant(t, users.alice, null, ids.B)).toBe(ids.A); // forged cookie ignored
		expect(requestTenant(t, users.alice, null, '')).toBe(ids.A); // "all" is for 'all' users only
		expect(requestTenant(t, users.alice, ids.B, null)).toBe(ids.A); // foreign host ignored
		expect(requestTenant(t, users.multi, ids.B, null)).toBe(ids.B);
		expect(requestTenant(t, users.nobody, ids.A, ids.A)).toBeNull();
		expect(requestTenant(t, users.admin, null, '')).toBeNull();
		expect(requestTenant(t, users.admin, null, ids.B)).toBe(ids.B);
		expect(requestTenant(t, users.admin, null, null)).toBeNull();
	});

	it('tenantByHost resolves custom domains and subdomains, nothing else', async () => {
		const resolve = t.resolveTenant!;
		const at = (host: string) =>
			resolve({ event: { url: new URL(`https://${host}/`) } as RequestEvent, cms: system() });
		expect(await at('hotel-a.test')).toBe(ids.A);
		expect(await at('HOTEL-A.test:8443')).toBe(ids.A);
		expect(await at('b.example.com')).toBe(ids.B);
		expect(await at('x.b.example.com')).toBeNull();
		expect(await at('example.com')).toBeNull();
		expect(await at('b.example.com.evil.test')).toBeNull();
	});

	it('the selection cookie is validated on read and write', () => {
		expect(readTenantCookie(`a=1; kitcms-tenant=${ids.A}`)).toBe(ids.A);
		expect(readTenantCookie('kitcms-tenant=')).toBe('');
		expect(readTenantCookie('kitcms-tenant=a%2Fb')).toBeNull();
		expect(readTenantCookie('kitcms-tenant=%E0%A4%A')).toBeNull();
		expect(readTenantCookie(null)).toBeNull();
		expect(serializeTenantCookie(ids.A, { base: '', secure: true })).toMatch(/HttpOnly; SameSite=Lax; .*Secure/);
		expect(() => serializeTenantCookie('a;b', { base: '', secure: false })).toThrow();
	});

	it('a malformed request tenant denies', () => {
		const pages = config.collectionsBySlug.pages!;
		const req = { user: null, context: {}, cms: {} as never, source: 'local' as const, tenant: '' };
		expect(tenantScope(pages, 'read', req, true)).toBe(false);
	});
});

describe('storage prefix', () => {
	it('defaults to tenants/<id>/ and rejects unsafe prefixes', () => {
		expect(storagePrefixFor(config.tenancy, 'T1')).toBe('tenants/T1/');
		expect(storagePrefixFor(config.tenancy, null)).toBe('');
		const bad = (p: string) => ({ ...(config.tenancy as object), storagePrefix: () => p }) as never;
		for (const p of ['../x/', '/abs/', 'a//b/', 'no-slash', 'a/../b/', 'sp ace/']) {
			expect(() => storagePrefixFor(bad(p), 'T')).toThrow(/unsafe prefix/);
		}
	});
});

describe('edge cache keys include the tenant', () => {
	it('the same anonymous read for two tenants never shares an entry', async () => {
		const store = new Map<string, Response>();
		const cache = {
			match: async (u: string) => store.get(u)?.clone(),
			put: async (u: string, r: Response) => void store.set(u, r.clone()),
			delete: async () => true,
		} as unknown as Cache;
		const fake = (t: string) => ({ find: async () => ({ docs: [{ tenant: t }] }) }) as unknown as Cms;
		const opts = { ttl: 60, cache, configId: 'x' };
		const a = await withEdgeCache(fake('A'), { user: null, tenant: 'A' }, opts).find('pages' as never);
		const b = await withEdgeCache(fake('B'), { user: null, tenant: 'B' }, opts).find('pages' as never);
		expect(a).toEqual({ docs: [{ tenant: 'A' }] });
		expect(b).toEqual({ docs: [{ tenant: 'B' }] });
	});
});

// ---------------------------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------------------------

describe('RPC', () => {
	const RPC = createKitcmsRPC(rawConfig);
	const rpc = () => {
		const Ctor = RPC as unknown as new () => InstanceType<typeof RPC> & { env: object; ctx: object };
		const r = new Ctor();
		Object.assign(r, { env: { DB: d1, BUCKET: bucket }, ctx: { waitUntil: () => {} } });
		return r;
	};
	const code = (c: string) => new RegExp(`^kitcms:${c}:`);

	it('anonymous reads need a tenant and stay in it', async () => {
		await expect(rpc().find('pages')).rejects.toThrow(code('FORBIDDEN'));
		const r = (await rpc().find('pages', { tenant: ids.B, limit: 100 })) as { docs: Doc[] };
		expect(tenantsOf(r)).toEqual([ids.B]);
		expect(await rpc().findByID('pages', ids.pA, { tenant: ids.B })).toBeNull();
		expect(await rpc().count('pages', { tenant: ids.A, where: { id: { equals: ids.pB } } })).toBe(0);
		expect(await rpc().findOne('pages', { tenant: ids.A, where: { slug: { equals: 'home' } } })).toMatchObject({ id: ids.pA });
	});

	it('system calls with a tenant are scoped; without one, unscoped', async () => {
		const scoped = (await rpc().find('pages', { as: 'system', tenant: ids.A, limit: 100 })) as { docs: Doc[] };
		expect(tenantsOf(scoped)).toEqual([ids.A]);
		const all = (await rpc().find('pages', { as: 'system', limit: 100 })) as { docs: Doc[] };
		expect(tenantsOf(all).sort()).toEqual([ids.A, ids.B].sort());
	});

	it('system writes with a tenant: forced tenant, no cross-tenant targets', async () => {
		const doc = (await rpc().create('pages', { title: 'RPC', tenant: ids.B }, { as: 'system', tenant: ids.A })) as Doc;
		expect(doc.tenant).toBe(ids.A);
		await expect(rpc().update('pages', ids.pB, { title: 'pwned' }, { as: 'system', tenant: ids.A })).rejects.toThrow(code('NOT_FOUND'));
		await expect(rpc().delete('pages', ids.pB, { as: 'system', tenant: ids.A })).rejects.toThrow(code('NOT_FOUND'));
		await expect(rpc().unpublish('pages', ids.pB, { as: 'system', tenant: ids.A })).rejects.toThrow(code('NOT_FOUND'));
		await expect(rpc().move('pages', ids.pB, { after: ids.pA }, { as: 'system', tenant: ids.A })).rejects.toThrow(code('NOT_FOUND'));
		await expect(rpc().create('pages', { title: 'x', cover: ids.mB }, { as: 'system', tenant: ids.A })).rejects.toThrow(code('VALIDATION'));
	});

	it('rejects malformed tenants and tenants without the plugin', async () => {
		for (const tenant of ['', 'a/b', 'x'.repeat(200), 42]) {
			await expect(rpc().find('pages', { tenant } as never)).rejects.toThrow(code('QUERY'));
		}
		const Plain = createKitcmsRPC(defineConfig({ collections: [collection({ slug: 'notes', access: { read: () => true }, fields: {} })] }));
		const p = new (Plain as unknown as new () => InstanceType<typeof Plain> & { env: object; ctx: object })();
		Object.assign(p, { env: { DB: d1 }, ctx: { waitUntil: () => {} } });
		await expect(p.find('notes', { tenant: 'x' })).rejects.toThrow(/multi-tenant plugin/);
	});
});

// ---------------------------------------------------------------------------------------------
// REST + admin actions + uploads
// ---------------------------------------------------------------------------------------------

const ORIGIN = 'https://admin.test';
function event(method: string, url: string, init: { body?: BodyInit; type?: string; path?: string } = {}): RequestEvent {
	const u = new URL(url, ORIGIN);
	const headers = new Headers({ origin: ORIGIN });
	if (init.type) headers.set('content-type', init.type);
	const request = new Request(u, { method, headers, body: init.body ?? null });
	return { request, url: u, params: { path: init.path ?? '' }, locals: {} } as unknown as RequestEvent;
}

describe('REST', () => {
	let api: typeof import('../../core/src/sveltekit/api');
	beforeAll(async () => {
		api = await import('../../core/src/sveltekit/api');
	});
	beforeEach(() => {
		current = internalsFor(users.alice, ids.A);
	});
	const json = async (r: Response) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> });

	it('lists, reads and writes only the request tenant', async () => {
		const list = await json(await api.GET(event('GET', '/api/collections/pages?limit=100', { path: 'collections/pages' })));
		expect(tenantsOf(list.body as never)).toEqual([ids.A]);
		expect((await api.GET(event('GET', `/api/collections/pages/${ids.pB}`, { path: `collections/pages/${ids.pB}` }))).status).toBe(404);
		const patch = await api.PATCH(
			event('PATCH', `/api/collections/pages/${ids.pB}`, { path: `collections/pages/${ids.pB}`, body: JSON.stringify({ title: 'pwned' }), type: 'application/json' }),
		);
		expect(patch.status).toBe(404);
		const del = await api.DELETE(event('DELETE', `/api/collections/pages/${ids.pB}`, { path: `collections/pages/${ids.pB}` }));
		expect(del.status).toBe(404);
		const post = await json(
			await api.POST(event('POST', '/api/collections/pages', { path: 'collections/pages', body: JSON.stringify({ title: 'REST', tenant: ids.B }), type: 'application/json' })),
		);
		expect(post.status).toBe(201);
		expect(((post.body.doc ?? post.body) as Doc).tenant).toBe(ids.A);
	});
});

describe('admin actions', () => {
	let actions: typeof import('../../core/src/sveltekit/admin').actions;
	beforeAll(async () => {
		actions = (await import('../../core/src/sveltekit/admin')).actions;
	});
	beforeEach(() => {
		current = internalsFor(users.alice, ids.A);
	});
	const form = (entries: Record<string, string>) => {
		const fd = new FormData();
		for (const [k, v] of Object.entries(entries)) fd.set(k, v);
		return fd;
	};
	const run = async (name: string, path: string, body?: FormData) => {
		try {
			return await (actions as Record<string, (e: RequestEvent) => Promise<unknown>>)[name]!(
				event('POST', `/admin/${path}?/${name}`, { path, body }),
			);
		} catch (thrown) {
			return { thrown };
		}
	};

	it('save, delete and unpublish of another tenant’s doc fail; B is untouched', async () => {
		const save = (await run('save', `collections/pages/${ids.pB}`, form({ title: 'pwned' }))) as { status?: number };
		expect(save.status).toBe(404);
		const del = (await run('delete', `collections/pages/${ids.pB}`)) as { status?: number };
		expect(del.status).toBe(404);
		const unpub = (await run('unpublish', `collections/pages/${ids.pB}`)) as { status?: number };
		expect(unpub.status).toBe(404);
		const bulk = (await run('bulkDelete', 'collections/pages', (() => { const fd = new FormData(); fd.append('__ids', ids.pB); return fd; })())) as { status?: number };
		expect(bulk.status).toBe(409);
		const b = (await system().findByID('pages', ids.pB, { draft: true })) as Doc;
		expect(b.title).toBe('B draft');
	});

	it('create through the admin lands in the selected tenant', async () => {
		const out = (await run('save', 'collections/pages/create', form({ title: 'Admin made', tenant: ids.B }))) as { thrown?: { status: number; location: string } };
		expect(out.thrown?.status).toBe(303);
		const id = out.thrown!.location.split('/').pop()!;
		expect(((await system().findByID('pages', id)) as Doc).tenant).toBe(ids.A);
	});
});

describe('uploads', () => {
	it('stores the file under the tenant prefix and forces the tenant', async () => {
		const k = internalsFor(users.alice, ids.A);
		const fd = new FormData();
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
		fd.set('file', new File([png], 'a.png', { type: 'image/png' }));
		fd.set('tenant', ids.B);
		const res = await handleUpload(event('POST', '/api/upload/media', { body: fd }), k, 'media');
		expect(res.status).toBe(201);
		const body = (await res.json()) as { doc: Doc };
		expect(body.doc.tenant).toBe(ids.A);
		expect(String(body.doc.key).startsWith(`tenants/${ids.A}/`)).toBe(true);
		expect(await bucket.head(String(body.doc.key))).not.toBeNull();
	});

	it('cannot replace another tenant’s file', async () => {
		const k = internalsFor(users.alice, ids.A);
		const fd = new FormData();
		fd.set('file', new File([new Uint8Array([1, 2, 3])], 'a.bin'));
		fd.set('id', ids.mB);
		const res = await handleUpload(event('POST', '/api/upload/media', { body: fd }), k, 'media');
		expect(res.status).toBe(404);
	});
});

describe('session', () => {
	it('the signed-in user carries their tenants (Better Auth additional field, not client-writable)', async () => {
		const { createUserWithPassword, signIn } = await import('../../core/src/auth/users');
		const { resolveSession } = await import('../../core/src/auth/module');
		const k = internalsFor(users.admin, null);
		(k.env as Record<string, unknown>).BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-1234';
		const created = await createUserWithPassword(k, { email: 'carol@x.io', name: 'carol', password: 'correct horse', tenants: [ids.B] } as never);
		const set: { name: string; value: string }[] = [];
		const eventFor = (headers: Record<string, string>) => {
			const h = new Headers({ 'cf-connecting-ip': '7.7.7.7', ...headers });
			const e = {
				url: new URL('http://localhost:5173/admin'),
				request: new Request('http://localhost:5173/admin', { headers: h }),
				cookies: { set: (name: string, value: string) => set.push({ name, value }), get: () => undefined, getAll: () => [], delete: () => {}, serialize: () => '' },
			};
			events.current = e;
			return { e, h };
		};
		const { h } = eventFor({});
		const user = await signIn(k, { email: 'carol@x.io', password: 'correct horse', headers: h });
		expect(user).toMatchObject({ id: created.id, tenants: [ids.B] });
		const cookie = set.find((c) => c.name.includes('session_token'))!;
		const authed = eventFor({ cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` });
		const resolved = await resolveSession(authed.e as never, k);
		expect(resolved?.user.tenants).toEqual([ids.B]);
		events.current = undefined;
	});
});
