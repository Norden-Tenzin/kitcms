// Access engine tests (security-critical: written by Opus, plan §4.6, Decision 22).
import { describe, expect, it } from 'vitest';
import { collection, defineConfig, global } from '../config/collection';
import { fields as f } from '../config/fields';
import type { KitcmsReq, KitcmsUser } from '../config/hooks';
import { sanitizeConfig } from '../config/sanitize';
import {
	adminAccess,
	applyWriteFieldAccess,
	collectionAccess,
	filterReadableFields,
	markUploadWrite,
	mergeWhere,
	normalizeDecision,
} from './engine';

const admin: KitcmsUser = { id: 'a1', email: 'a@x.io', name: 'A', role: 'admin', collection: 'users' };
const editor: KitcmsUser = { id: 'e1', email: 'e@x.io', name: 'E', role: 'editor', collection: 'users' };
const stranger: KitcmsUser = { id: 's1', email: 's@x.io', name: 'S', role: 'hacker', collection: 'users' };

const req = (user: KitcmsUser | null): KitcmsReq =>
	({ user, context: {}, cms: {} as never, source: 'local' }) as KitcmsReq;

const config = sanitizeConfig(
	defineConfig({
		collections: [
			collection({ slug: 'media', upload: true, fields: { alt: f.text() } }),
			collection({
				slug: 'pages',
				access: {
					read: ({ req }) => (req.user ? true : { status: { equals: 'published' } }),
					create: ({ req }) => req.user?.role === 'admin',
					// Misbehaving rules: must deny, never allow.
					delete: (() => 'yes') as never,
				},
				fields: {
					title: f.text(),
					status: f.select({ options: ['draft', 'published'] }),
					secret: f.text({ access: { read: ({ req }) => req.user?.role === 'admin' } }),
					locked: f.text({ access: { update: () => false, create: () => false } }),
					seo: f.group({
						fields: { note: f.text({ access: { read: () => false, update: () => false } }) },
					}),
					rows: f.array({
						fields: {
							label: f.text(),
							price: f.number({ access: { update: ({ req }) => req.user?.role === 'admin' } }),
						},
					}),
				},
			}),
			collection({ slug: 'notes', fields: { body: f.textarea() } }),
		],
	}),
);
const pages = config.collectionsBySlug.pages!;
const notes = config.collectionsBySlug.notes!;
const users = config.collectionsBySlug.users!;
const media = config.collectionsBySlug.media!;

describe('normalizeDecision (fail closed)', () => {
	it('accepts true, false and plain where objects', () => {
		expect(normalizeDecision(true, true)).toBe(true);
		expect(normalizeDecision(false, true)).toBe(false);
		expect(normalizeDecision({ a: { equals: 1 } }, true)).toEqual({ a: { equals: 1 } });
	});
	it('denies anything else', () => {
		for (const v of [undefined, null, 1, 'true', [], new Date(), () => true]) {
			expect(normalizeDecision(v, true)).toBe(false);
		}
	});
	it('denies where objects when not allowed (create/admin)', () => {
		expect(normalizeDecision({ a: { equals: 1 } }, false)).toBe(false);
	});
});

describe('collection defaults (Decision 22)', () => {
	it('regular collections: signed-in only', async () => {
		for (const op of ['read', 'create', 'update', 'delete'] as const) {
			expect(await collectionAccess(notes, op, { req: req(null) })).toBe(false);
			expect(await collectionAccess(notes, op, { req: req(editor) })).toBe(true);
		}
	});
	it('auth collection: create/delete admin only, update admin or self', async () => {
		expect(await collectionAccess(users, 'read', { req: req(null) })).toBe(false);
		expect(await collectionAccess(users, 'read', { req: req(editor) })).toBe(true);
		expect(await collectionAccess(users, 'create', { req: req(editor) })).toBe(false);
		expect(await collectionAccess(users, 'create', { req: req(admin) })).toBe(true);
		expect(await collectionAccess(users, 'delete', { req: req(editor) })).toBe(false);
		expect(await collectionAccess(users, 'delete', { req: req(admin) })).toBe(true);
		expect(await collectionAccess(users, 'update', { req: req(admin) })).toBe(true);
		expect(await collectionAccess(users, 'update', { req: req(editor) })).toEqual({
			id: { equals: 'e1' },
		});
		expect(await collectionAccess(users, 'update', { req: req(null) })).toBe(false);
	});
	it('overrideAccess allows everything', async () => {
		expect(await collectionAccess(users, 'delete', { req: req(null), overrideAccess: true })).toBe(true);
	});
});

describe('custom collection rules', () => {
	it('returns where filters for read', async () => {
		expect(await collectionAccess(pages, 'read', { req: req(null) })).toEqual({
			status: { equals: 'published' },
		});
	});
	it('create is boolean only', async () => {
		expect(await collectionAccess(pages, 'create', { req: req(editor) })).toBe(false);
		expect(await collectionAccess(pages, 'create', { req: req(admin) })).toBe(true);
	});
	it('a rule returning garbage denies', async () => {
		expect(await collectionAccess(pages, 'delete', { req: req(admin) })).toBe(false);
	});
	it('a throwing rule fails the operation', async () => {
		const c = sanitizeConfig(
			defineConfig({
				collections: [
					collection({
						slug: 'x',
						access: {
							read: () => {
								throw new Error('boom');
							},
						},
						fields: {},
					}),
				],
			}),
		).collectionsBySlug.x!;
		await expect(collectionAccess(c, 'read', { req: req(admin) })).rejects.toThrow('boom');
	});
});

describe('mergeWhere', () => {
	it('true keeps the caller filter', () => {
		expect(mergeWhere({ a: { equals: 1 } }, true)).toEqual({ a: { equals: 1 } });
		expect(mergeWhere(undefined, true)).toBeUndefined();
	});
	it('ANDs the access filter as its own group, so a caller `or` cannot widen it', () => {
		const access = { status: { equals: 'published' } };
		const caller = { or: [{ status: { equals: 'draft' } }, { title: { exists: true } }] };
		expect(mergeWhere(caller, access)).toEqual({ and: [caller, access] });
		expect(mergeWhere(undefined, access)).toEqual({ and: [access] });
		expect(mergeWhere({}, access)).toEqual({ and: [access] });
	});
});

describe('adminAccess', () => {
	it('default: role must be one of the role field options', async () => {
		expect(await adminAccess(config, req(null))).toBe(false);
		expect(await adminAccess(config, req(admin))).toBe(true);
		expect(await adminAccess(config, req(editor))).toBe(true);
		expect(await adminAccess(config, req(stranger))).toBe(false);
	});
	it('custom access.admin, fail closed', async () => {
		const c = sanitizeConfig(
			defineConfig({
				collections: [
					collection({
						slug: 'users',
						auth: true,
						access: { admin: (({ req }: { req: KitcmsReq }) => (req.user ? { x: 1 } : false)) as never },
						fields: {},
					}),
				],
			}),
		);
		expect(await adminAccess(c, req(admin))).toBe(false); // a where object is not `true`
	});
});

describe('field read access', () => {
	it('removes denied fields, including nested ones', async () => {
		const doc = { id: 'p', title: 'T', secret: 'S', seo: { note: 'N' }, rows: [] };
		await filterReadableFields(pages.fields, doc, req(editor), 'p');
		expect(doc).toEqual({ id: 'p', title: 'T', seo: {}, rows: [] });
		const doc2 = { id: 'p', secret: 'S' };
		await filterReadableFields(pages.fields, doc2, req(admin), 'p');
		expect(doc2).toEqual({ id: 'p', secret: 'S' });
	});
});

describe('field write access', () => {
	const ctx = (user: KitcmsUser | null, data: Record<string, unknown>) => ({
		req: req(user),
		root: data,
		topLevel: true,
	});

	it('create: denied values are dropped (default applies)', async () => {
		const data: Record<string, unknown> = { title: 'T', locked: 'L' };
		await applyWriteFieldAccess(pages, pages.fields, data, 'create', ctx(admin, data), undefined);
		expect(data).toEqual({ title: 'T' });
	});

	it('update: denied values are reset to the stored value, nested too', async () => {
		const stored = {
			locked: 'old',
			seo: { note: 'stored note' },
			rows: [
				{ id: 'r1', label: 'a', price: 10 },
				{ id: 'r2', label: 'b', price: 20 },
			],
		};
		const data: Record<string, unknown> = {
			locked: 'new',
			seo: { note: 'hacked' },
			rows: [
				{ id: 'r2', label: 'B', price: 1 }, // reordered, price change denied
				{ id: 'r1', label: 'A', price: 2 },
				{ label: 'new row', price: 99 }, // new row: denied price dropped
				{ id: 'forged', label: 'x', price: 5 }, // unknown id = new row
			],
		};
		await applyWriteFieldAccess(pages, pages.fields, data, 'update', ctx(editor, data), stored);
		expect(data).toEqual({
			locked: 'old',
			seo: { note: 'stored note' },
			rows: [
				{ id: 'r2', label: 'B', price: 20 },
				{ id: 'r1', label: 'A', price: 10 },
				{ label: 'new row' },
				{ id: 'forged', label: 'x' },
			],
		});
	});

	it('update: admins may change what editors may not', async () => {
		const stored = { rows: [{ id: 'r1', price: 10 }] };
		const data: Record<string, unknown> = { rows: [{ id: 'r1', price: 2 }] };
		await applyWriteFieldAccess(pages, pages.fields, data, 'update', ctx(admin, data), stored);
		expect(data).toEqual({ rows: [{ id: 'r1', price: 2 }] });
	});

	it('auth collection: only admins write role and emailVerified', async () => {
		const stored = { role: 'editor', emailVerified: false, name: 'E' };
		const data: Record<string, unknown> = { role: 'admin', emailVerified: true, name: 'New' };
		await applyWriteFieldAccess(users, users.fields, data, 'update', ctx(editor, data), stored);
		expect(data).toEqual({ role: 'editor', emailVerified: false, name: 'New' });

		const created: Record<string, unknown> = { role: 'admin', email: 'x@y.z', name: 'X' };
		await applyWriteFieldAccess(users, users.fields, created, 'create', ctx(editor, created), undefined);
		expect(created).toEqual({ email: 'x@y.z', name: 'X' });

		const byAdmin: Record<string, unknown> = { role: 'admin' };
		await applyWriteFieldAccess(users, users.fields, byAdmin, 'update', ctx(admin, byAdmin), stored);
		expect(byAdmin).toEqual({ role: 'admin' });
	});

	it('upload built-ins are writable only by the upload endpoint', async () => {
		const forged: Record<string, unknown> = { key: 'other-tenant/file.png', filename: 'x', alt: 'a' };
		await applyWriteFieldAccess(media, media.fields, forged, 'create', ctx(admin, forged), undefined);
		expect(forged).toEqual({ alt: 'a' });

		const r = req(admin);
		markUploadWrite(r);
		const real: Record<string, unknown> = { key: 'k', filename: 'f.png', alt: 'a' };
		await applyWriteFieldAccess(media, media.fields, real, 'create', { req: r, root: real, topLevel: true }, undefined);
		expect(real).toEqual({ key: 'k', filename: 'f.png', alt: 'a' });

		const update: Record<string, unknown> = { key: 'swap' };
		await applyWriteFieldAccess(media, media.fields, update, 'update', ctx(admin, update), { key: 'k' });
		expect(update).toEqual({ key: 'k' });
	});
});

describe('locked collections and globals (§13.3, §13.1)', () => {
	const cfg = sanitizeConfig(
		defineConfig({
			collections: [
				collection({
					slug: 'fixed',
					admin: { locked: true },
					// Permissive rules must not re-open create/delete on a locked collection.
					access: { create: () => true, delete: () => true, update: () => true, read: () => true },
					fields: { title: f.text() },
				}),
			],
			globals: [global({ slug: 'site', access: { read: () => true, update: () => true }, fields: { name: f.text() } })],
		}),
	);
	const fixed = cfg.collectionsBySlug.fixed!;
	const site = cfg.globalsBySlug.site!;

	it('denies create and delete to everyone, admins included', async () => {
		for (const u of [null, editor, admin]) {
			expect(await collectionAccess(fixed, 'create', { req: req(u) })).toBe(false);
			expect(await collectionAccess(fixed, 'delete', { req: req(u), id: 'x' })).toBe(false);
		}
	});
	it('keeps update and read rules', async () => {
		expect(await collectionAccess(fixed, 'update', { req: req(editor), id: 'x' })).toBe(true);
		expect(await collectionAccess(fixed, 'read', { req: req(null) })).toBe(true);
	});
	it('overrideAccess (seed, system RPC) may still create and delete', async () => {
		expect(await collectionAccess(fixed, 'create', { req: req(null), overrideAccess: true })).toBe(true);
		expect(await collectionAccess(fixed, 'delete', { req: req(null), overrideAccess: true })).toBe(true);
	});
	it('globals: never create/delete, read/update follow their rules', async () => {
		expect(await collectionAccess(site, 'create', { req: req(admin) })).toBe(false);
		expect(await collectionAccess(site, 'delete', { req: req(admin) })).toBe(false);
		expect(await collectionAccess(site, 'update', { req: req(null) })).toBe(true);
	});
	it('slug lookups ignore inherited keys', () => {
		for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
			expect(cfg.collectionsBySlug[k]).toBeUndefined();
			expect(cfg.globalsBySlug[k]).toBeUndefined();
		}
	});
	it('globals are not reachable as collections', () => {
		expect(cfg.collectionsBySlug['_global_site']).toBeUndefined();
		expect(cfg.collectionsBySlug.site).toBeUndefined();
	});
});
