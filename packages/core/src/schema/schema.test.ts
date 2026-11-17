import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { afterAll, describe, expect, it } from 'vitest';
import { block, collection, defineConfig, type CollectionDef } from '../config/collection';
import { fields as f } from '../config/fields';
import { sanitizeConfig } from '../config/sanitize';
import { generateDrizzleSchema } from './codegen';
import { buildTables, getTables } from './drizzle';
import type { ColumnSpec, TableSpec } from './spec';
import { toTableSpecs } from './tables';

const sanitize = (...c: CollectionDef[]) => sanitizeConfig(defineConfig({ collections: c }));
const byName = (specs: TableSpec[]) => Object.fromEntries(specs.map((s) => [s.name, s]));
const cols = (t: TableSpec) => t.columns.map((c) => c.name);
const col = (t: TableSpec, n: string): ColumnSpec => {
	const c = t.columns.find((x) => x.name === n);
	if (!c) throw new Error(`no column ${n}`);
	return c;
};

const media = collection({ slug: 'media', upload: true, fields: {} } as never);
const hero = block({ slug: 'hero', fields: { heading: f.text() } } as never);
const pages = collection({
	slug: 'pages',
	fields: {
		title: f.text({ required: true, index: true }),
		summary: f.textarea(),
		contact: f.email({ unique: true }),
		slug: f.slug({ from: 'title', unique: true }),
		views: f.number({ index: true }),
		featured: f.checkbox({ defaultValue: true }),
		visible: f.checkbox(),
		status: f.select({ options: ['a', 'b'], required: true, index: true }),
		publishedAt: f.date(),
		body: f.richText(),
		meta: f.json(),
		seo: f.group({ fields: { title: f.text() } }),
		items: f.array({ fields: { label: f.text() } }),
		content: f.blocks({ blocks: [hero] }),
		parent: f.relationship({ relationTo: 'pages', required: true }),
		related: f.relationship({ relationTo: 'pages', hasMany: true }),
		cover: f.upload({ relationTo: 'media' }),
		gallery: f.upload({ relationTo: 'media', hasMany: true }),
		row: f.row({ fields: { inRow: f.text() } }),
	},
} as never);
const staff = collection({
	slug: 'staff',
	auth: true,
	fields: { role: f.select({ options: ['owner', 'admin', 'editor'], required: true }), phone: f.text() },
} as never);

describe('toTableSpecs', () => {
	const specs = toTableSpecs(sanitize(pages, media, staff));
	const t = byName(specs);

	it('orders collections, _refs, auth tables', () => {
		expect(specs.map((s) => s.name)).toEqual([
			'pages',
			'media',
			'staff',
			'_refs',
			'auth_sessions',
			'auth_accounts',
			'auth_verifications',
			'auth_rate_limits',
		]);
	});

	it('maps a collection table', () => {
		const p = t.pages!;
		expect(p.columns).toEqual([
			{ name: 'id', kind: 'text', primaryKey: true, notNull: true },
			{ name: 'createdAt', kind: 'timestamp', notNull: true },
			{ name: 'updatedAt', kind: 'timestamp', notNull: true },
			{ name: 'title', kind: 'text' },
			{ name: 'summary', kind: 'text' },
			{ name: 'contact', kind: 'text' },
			{ name: 'slug', kind: 'text' },
			{ name: 'views', kind: 'real' },
			{ name: 'featured', kind: 'boolean', notNull: true, default: true },
			{ name: 'visible', kind: 'boolean', notNull: true, default: false },
			{ name: 'status', kind: 'text' },
			{ name: 'publishedAt', kind: 'timestamp' },
			{ name: 'body', kind: 'json' },
			{ name: 'meta', kind: 'json' },
			{ name: 'seo', kind: 'json' },
			{ name: 'items', kind: 'json' },
			{ name: 'content', kind: 'json' },
			{ name: 'parent', kind: 'text', references: { table: 'pages', column: 'id', onDelete: 'set null' } },
			{ name: 'related', kind: 'json' },
			{ name: 'cover', kind: 'text', references: { table: 'media', column: 'id', onDelete: 'set null' } },
			{ name: 'gallery', kind: 'json' },
			{ name: 'inRow', kind: 'text' },
		]);
		expect(p.indexes).toEqual([
			{ name: 'pages_createdAt_idx', columns: ['createdAt'], unique: false },
			{ name: 'pages_title_idx', columns: ['title'], unique: false },
			{ name: 'pages_contact_unique', columns: ['contact'], unique: true },
			{ name: 'pages_slug_unique', columns: ['slug'], unique: true },
			{ name: 'pages_views_idx', columns: ['views'], unique: false },
			{ name: 'pages_status_idx', columns: ['status'], unique: false },
			{ name: 'pages_parent_idx', columns: ['parent'], unique: false },
			{ name: 'pages_cover_idx', columns: ['cover'], unique: false },
		]);
	});

	it('maps an upload collection', () => {
		const m = t.media!;
		expect(cols(m)).toEqual(['id', 'createdAt', 'updatedAt', 'filename', 'mimeType', 'filesize', 'width', 'height', 'key']);
		expect(col(m, 'filesize').kind).toBe('real');
		expect(m.indexes.map((i) => [i.name, i.unique])).toEqual([
			['media_createdAt_idx', false],
			['media_key_unique', true],
		]);
	});

	it('maps a custom auth collection', () => {
		const s = t.staff!;
		expect(cols(s).slice(0, 3)).toEqual(['id', 'createdAt', 'updatedAt']);
		expect([...cols(s)].sort()).toEqual(
			['id', 'createdAt', 'updatedAt', 'email', 'name', 'role', 'emailVerified', 'image', 'phone'].sort(),
		);
		expect(col(s, 'role').kind).toBe('text');
		expect(col(s, 'emailVerified')).toEqual({ name: 'emailVerified', kind: 'boolean', notNull: true, default: false });
		expect(s.indexes.map((i) => i.name)).toContain('staff_email_unique');
	});

	it('maps _refs', () => {
		const r = t._refs!;
		expect(r.columns).toEqual(
			['fromCollection', 'fromId', 'path', 'toCollection', 'toId'].map((name) => ({ name, kind: 'text', notNull: true })),
		);
		expect(r.indexes).toEqual([
			{ name: '_refs_from_idx', columns: ['fromCollection', 'fromId'], unique: false },
			{ name: '_refs_to_idx', columns: ['toCollection', 'toId'], unique: false },
			{ name: '_refs_path_idx', columns: ['fromCollection', 'path', 'toId'], unique: false },
		]);
	});

	it('maps the Better Auth tables with FKs to the auth collection', () => {
		const fk = { table: 'staff', column: 'id', onDelete: 'cascade' };
		const sessions = t.auth_sessions!;
		expect(cols(sessions)).toEqual(['id', 'expiresAt', 'token', 'createdAt', 'updatedAt', 'ipAddress', 'userAgent', 'userId']);
		expect(col(sessions, 'userId')).toEqual({ name: 'userId', kind: 'text', notNull: true, references: fk });
		expect(sessions.indexes).toEqual([
			{ name: 'auth_sessions_token_unique', columns: ['token'], unique: true },
			{ name: 'auth_sessions_userId_idx', columns: ['userId'], unique: false },
		]);
		const accounts = t.auth_accounts!;
		expect(cols(accounts)).toEqual([
			'id', 'accountId', 'providerId', 'userId', 'accessToken', 'refreshToken', 'idToken',
			'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'password', 'createdAt', 'updatedAt',
		]);
		expect(col(accounts, 'userId').references).toEqual(fk);
		expect(col(accounts, 'accessTokenExpiresAt')).toEqual({ name: 'accessTokenExpiresAt', kind: 'timestamp' });
		expect(accounts.indexes).toEqual([{ name: 'auth_accounts_userId_idx', columns: ['userId'], unique: false }]);
		expect(cols(t.auth_verifications!)).toEqual(['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt']);
		expect(t.auth_verifications!.indexes).toEqual([
			{ name: 'auth_verifications_identifier_idx', columns: ['identifier'], unique: false },
		]);
		expect(t.auth_rate_limits!.columns).toEqual([
			{ name: 'id', kind: 'text', primaryKey: true, notNull: true },
			{ name: 'key', kind: 'text', notNull: true },
			{ name: 'count', kind: 'integer', notNull: true },
			{ name: 'lastRequest', kind: 'integer', notNull: true },
		]);
		expect(t.auth_rate_limits!.indexes).toEqual([
			{ name: 'auth_rate_limits_key_unique', columns: ['key'], unique: true },
		]);
	});

	it('uses the default users collection when none has auth', () => {
		const s = byName(toTableSpecs(sanitize(media)));
		expect(Object.keys(s)).toEqual(['media', 'users', '_refs', 'auth_sessions', 'auth_accounts', 'auth_verifications', 'auth_rate_limits']);
		expect(col(s.auth_sessions!, 'userId').references).toEqual({ table: 'users', column: 'id', onDelete: 'cascade' });
	});
});

describe('equivalence: runtime tables vs generated source', () => {
	const config = sanitize(pages, media, staff);
	const specs = toTableSpecs(config);
	const dir = new URL('../../.tmp-schema-test/', import.meta.url);
	// Node APIs are test-only; the specifier is a variable so core's Workers-only types don't need @types/node.
	const nodeFs = 'node:fs/promises';
	const nodeUrl = 'node:url';

	afterAll(async () => {
		const fs = await import(/* @vite-ignore */ nodeFs);
		const { fileURLToPath } = await import(/* @vite-ignore */ nodeUrl);
		await fs.rm(fileURLToPath(dir), { recursive: true, force: true });
	});

	it('is deterministic', () => {
		expect(generateDrizzleSchema(specs)).toBe(generateDrizzleSchema(toTableSpecs(config)));
		expect(generateDrizzleSchema(specs).startsWith('// GENERATED by kitcms from kitcms.config.ts. Do not edit.\n')).toBe(true);
	});

	it('caches getTables per config object', () => {
		expect(getTables(config)).toBe(getTables(config));
		expect(Object.keys(getTables(config))).toEqual(specs.map((s) => s.name));
	});

	it('generates identical tables', async () => {
		const fs = await import(/* @vite-ignore */ nodeFs);
		const { fileURLToPath } = await import(/* @vite-ignore */ nodeUrl);
		await fs.mkdir(fileURLToPath(dir), { recursive: true });
		const file = new URL('schema.ts', dir);
		await fs.writeFile(fileURLToPath(file), generateDrizzleSchema(specs));
		const mod = (await import(/* @vite-ignore */ file.href)) as Record<string, unknown>;
		const generated = Object.values(mod);
		const runtime = buildTables(specs);
		expect(generated).toHaveLength(specs.length);

		const summarize = (table: Parameters<typeof getTableConfig>[0]) => {
			const c = getTableConfig(table);
			return {
				name: c.name,
				columns: c.columns.map((x) => ({
					name: x.name,
					columnType: x.columnType,
					notNull: x.notNull,
					primary: x.primary,
					hasDefault: x.hasDefault,
					default: x.default,
				})),
				indexes: c.indexes.map((i) => ({
					name: i.config.name,
					unique: i.config.unique,
					columns: i.config.columns.map((x) => ('name' in x ? x.name : '')),
				})),
				foreignKeys: c.foreignKeys.map((fk) => {
					const r = fk.reference();
					return {
						columns: r.columns.map((x) => x.name),
						foreignTable: getTableConfig(r.foreignTable).name,
						foreignColumns: r.foreignColumns.map((x) => x.name),
						onDelete: fk.onDelete,
					};
				}),
			};
		};
		const byTable = (list: unknown[]) =>
			Object.fromEntries(
				list.map((t) => {
					const s = summarize(t as never);
					return [s.name, s];
				}),
			);
		const a = byTable(generated);
		const b = byTable(Object.values(runtime));
		expect(Object.keys(a)).toEqual(Object.keys(b));
		expect(a).toEqual(b);
		expect(a.pages!.foreignKeys.length).toBe(2);
		expect(a.auth_sessions!.foreignKeys[0]).toMatchObject({ foreignTable: 'staff', onDelete: 'cascade' });
	});

	it('handles unusual table names', () => {
		const src = generateDrizzleSchema([
			{ name: 'a-b', columns: [{ name: 'id', kind: 'text', primaryKey: true }], indexes: [] },
			{ name: 'a_b', columns: [{ name: 'id', kind: 'text', primaryKey: true }], indexes: [] },
		]);
		expect(src).toContain('export const t_a_b = ');
		expect(src).toContain('export const t_a_b_2 = ');
	});

	it('drizzle-kit generates the expected SQL', async () => {
		const fs = await import(/* @vite-ignore */ nodeFs);
		const { fileURLToPath } = await import(/* @vite-ignore */ nodeUrl);
		await fs.mkdir(fileURLToPath(dir), { recursive: true });
		const file = new URL('kit-schema.ts', dir);
		await fs.writeFile(fileURLToPath(file), generateDrizzleSchema(specs));
		const mod = (await import(/* @vite-ignore */ file.href)) as Record<string, unknown>;
		const kit = await import('drizzle-kit/api');
		const empty = kit.generateSQLiteDrizzleJson({});
		const next = await kit.generateSQLiteDrizzleJson(mod);
		const sql = (await kit.generateSQLiteMigration(await empty, next)).join('\n');
		expect(sql).toContain('CREATE TABLE `_refs`');
		expect(sql).toContain('ON DELETE set null');
		expect(sql).toContain('ON DELETE cascade');
		expect(sql).toContain('CREATE UNIQUE INDEX `pages_slug_unique`');
		expect(sql).toContain('CREATE INDEX `_refs_path_idx` ON `_refs` (`fromCollection`,`path`,`toId`)');
		expect(sql).toContain('`featured` integer DEFAULT true NOT NULL');
	});
});
