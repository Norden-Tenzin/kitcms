import { describe, expect, it } from 'vitest';
import { block, collection, defineConfig, type CollectionDef } from './collection';
import { fields as f } from './fields';
import { sanitizeConfig, toClientConfig, toLabel } from './sanitize';
import { ConfigError } from '../errors';

const cfg = (...collections: CollectionDef[]) => defineConfig({ collections });
const page = (fields: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
	collection({ slug: 'pages', fields: fields as never, ...extra } as never);
const sanitize = (...c: CollectionDef[]) => sanitizeConfig(cfg(...c));
const fieldsOf = (fieldDefs: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
	sanitize(page(fieldDefs, extra)).collectionsBySlug.pages!;
const fails = (fn: () => unknown, path: string | RegExp, msg?: RegExp) => {
	try {
		fn();
	} catch (e) {
		expect(e).toBeInstanceOf(ConfigError);
		const err = e as ConfigError;
		if (typeof path === 'string') expect(err.path).toBe(path);
		else expect(err.path).toMatch(path);
		if (msg) expect(err.message).toMatch(msg);
		return;
	}
	throw new Error('expected a ConfigError');
};

describe('singularize', () => {
	it('handles common plurals', async () => {
		const { singularize } = await import('./sanitize');
		expect(['Pages', 'Categories', 'Boxes', 'Addresses', 'Media', 'Status', 'Keys'].map(singularize)).toEqual([
			'Page', 'Category', 'Box', 'Address', 'Media', 'Status', 'Key',
		]);
	});
});

describe('toLabel', () => {
	it('humanizes names', () => {
		expect(toLabel('metaTitle')).toBe('Meta title');
		expect(toLabel('meta_title')).toBe('Meta title');
		expect(toLabel('meta-title')).toBe('Meta title');
		expect(toLabel('blog-posts')).toBe('Blog posts');
		expect(toLabel('title')).toBe('Title');
	});
});

describe('config defaults', () => {
	it('fills defaults and appends users', () => {
		const c = sanitize(page({ title: f.text() }));
		expect(c.collections.map((x) => x.slug)).toEqual(['pages', 'users']);
		expect(c.authCollection).toBe('users');
		expect(c.bindings).toEqual({ db: 'DB', bucket: 'BUCKET' });
		expect(c.admin.title).toBe('kitcms');
		expect(c.media).toEqual({});
		const users = c.collectionsBySlug.users!;
		expect(users.fields.map((x) => x.name)).toEqual(['email', 'name', 'role', 'emailVerified', 'image']);
		expect(users.admin.useAsTitle).toBe('email');
	});
	it('merges bindings and strips media slashes', () => {
		const c = sanitizeConfig({
			...cfg(page({})),
			bindings: { db: 'MYDB' },
			media: { publicUrl: 'https://m.example.com//' },
			admin: { title: 'X', user: 'users' },
		});
		expect(c.bindings).toEqual({ db: 'MYDB', bucket: 'BUCKET' });
		expect(c.media.publicUrl).toBe('https://m.example.com');
		expect(c.admin.title).toBe('X');
	});
	it('rejects bad media url and admin.user', () => {
		fails(() => sanitizeConfig({ ...cfg(page({})), media: { publicUrl: 'ftp://x' } }), 'media.publicUrl');
		fails(() => sanitizeConfig({ ...cfg(page({})), admin: { user: 'pages' } }), 'admin.user');
	});
	it('rejects a non-auth users collection when no auth exists', () => {
		fails(() => sanitize(collection({ slug: 'users', fields: {} })), 'collections.users', /auth: true/);
	});
	it('allows only one auth collection', () => {
		fails(
			() => sanitize(collection({ slug: 'a', fields: {}, auth: true }), collection({ slug: 'b', fields: {}, auth: true })),
			'collections.b.auth',
		);
	});
});

describe('collection slugs', () => {
	it.each(['_x', 'auth_x', 'sqlite_x', 'd1_migrations', 'Bad', '1a'])('rejects %s', (slug) => {
		fails(() => sanitize(collection({ slug, fields: {} })), `collections.${slug}`);
	});
	it('rejects duplicates', () => {
		fails(() => sanitize(page({}), page({})), 'collections.pages');
	});
	it('derives labels', () => {
		const c = sanitize(collection({ slug: 'blog-posts', fields: {} })).collectionsBySlug['blog-posts']!;
		expect(c.labels).toEqual({ plural: 'Blog posts', singular: 'Blog post' });
		const d = sanitize(collection({ slug: 'pages', fields: {}, labels: { singular: 'Doc' } })).collectionsBySlug.pages!;
		expect(d.labels).toEqual({ plural: 'Pages', singular: 'Doc' });
	});
});

describe('field names', () => {
	it('rejects invalid names', () => {
		fails(() => fieldsOf({ 'bad-name': f.text() }), 'collections.pages.fields.bad-name');
		fails(() => fieldsOf({ '1a': f.text() }), 'collections.pages.fields.1a');
	});
	it('rejects reserved names case-insensitively', () => {
		fails(() => fieldsOf({ id: f.text() }), 'collections.pages.fields.id');
		fails(() => fieldsOf({ CreatedAt: f.text() }), 'collections.pages.fields.CreatedAt');
	});
	it('rejects case-insensitive duplicates, including across layout', () => {
		fails(
			() => fieldsOf({ title: f.text(), r: f.row({ fields: { Title: f.text() } }) }),
			'collections.pages.fields.r.fields.Title',
			/collides/,
		);
	});
	it('reserves id in array rows and id/blockType in blocks', () => {
		fails(() => fieldsOf({ a: f.array({ fields: { id: f.text() } }) }), 'collections.pages.fields.a.fields.id');
		fails(
			() => fieldsOf({ b: f.blocks({ blocks: [block({ slug: 'x', fields: { blockType: f.text() } })] }) }),
			'collections.pages.fields.b.blocks.x.fields.blockType',
		);
		// `id` is fine in a group
		expect(() => fieldsOf({ g: f.group({ fields: { id: f.text() } }) })).not.toThrow();
	});
	it('reserves upload and auth built-ins', () => {
		fails(() => sanitize(collection({ slug: 'media', upload: true, fields: { filename: f.text() } })), 'collections.media.fields.filename');
		fails(() => sanitize(collection({ slug: 'u', auth: true, fields: { email: f.text() } })), 'collections.u.fields.email');
	});
});

describe('field defaults', () => {
	it('fills name, label, required, admin, hooks', () => {
		const t = fieldsOf({ metaTitle: f.text({ admin: { rows: 3 } as never }), x: f.text({ label: 'Custom', required: true }) });
		const [meta, x] = t.fields;
		expect(meta).toMatchObject({
			type: 'text',
			name: 'metaTitle',
			label: 'Meta title',
			required: false,
			index: false,
			unique: false,
			admin: { rows: 3 },
			hooks: { beforeValidate: [], beforeChange: [], afterChange: [], afterRead: [] },
		});
		expect(x).toMatchObject({ label: 'Custom', required: true });
	});
	it('normalizes hooks and copies access/validate/defaultValue', () => {
		const h = () => undefined;
		const validate = () => true as const;
		const access = { read: () => true };
		const t = fieldsOf({ a: f.text({ hooks: { beforeChange: h, afterRead: [h, h] }, validate, access, defaultValue: 'x' }) });
		const a = t.fields[0]!;
		expect(a.hooks.beforeChange).toEqual([h]);
		expect(a.hooks.afterRead).toEqual([h, h]);
		expect(a.validate).toBe(validate);
		expect(a.access).toBe(access);
		expect(a.defaultValue).toBe('x');
	});
});

describe('column options', () => {
	it('rejects unique/index on non-column types', () => {
		fails(() => fieldsOf({ a: f.richText({ unique: true } as never) }), 'collections.pages.fields.a');
		fails(() => fieldsOf({ a: f.relationship({ relationTo: 'pages', index: true } as never) }), 'collections.pages.fields.a');
		fails(() => fieldsOf({ a: f.textarea({ unique: true } as never) }), 'collections.pages.fields.a');
	});
	it('checkbox is never required or unique', () => {
		const c = fieldsOf({ a: f.checkbox({ defaultValue: true }) }).fields[0]!;
		expect(c).toMatchObject({ required: false, unique: false, index: false });
	});
	it('keeps unique and index', () => {
		expect(fieldsOf({ a: f.text({ unique: true, index: true }) }).fields[0]).toMatchObject({ unique: true, index: true });
	});
});

describe('text and number', () => {
	it('validates length bounds', () => {
		fails(() => fieldsOf({ a: f.text({ minLength: -1 }) }), 'collections.pages.fields.a.minLength');
		fails(() => fieldsOf({ a: f.text({ maxLength: 1.5 }) }), 'collections.pages.fields.a.maxLength');
		fails(() => fieldsOf({ a: f.textarea({ minLength: 5, maxLength: 2 }) }), 'collections.pages.fields.a');
		expect(fieldsOf({ a: f.text({ minLength: 1, maxLength: 5 }) }).fields[0]).toMatchObject({ minLength: 1, maxLength: 5 });
	});
	it('validates number bounds and defaults integer', () => {
		fails(() => fieldsOf({ a: f.number({ min: 5, max: 1 }) }), 'collections.pages.fields.a');
		expect(fieldsOf({ a: f.number({ min: -5, max: 5 }) }).fields[0]).toMatchObject({ integer: false, min: -5, max: 5 });
		expect(fieldsOf({ a: f.number({ integer: true }) }).fields[0]).toMatchObject({ integer: true });
	});
	it('checks static default types', () => {
		fails(() => fieldsOf({ a: f.text({ defaultValue: 1 as never }) }), 'collections.pages.fields.a.defaultValue');
		fails(() => fieldsOf({ a: f.number({ defaultValue: '1' as never }) }), 'collections.pages.fields.a.defaultValue');
		fails(() => fieldsOf({ a: f.checkbox({ defaultValue: 'x' as never }) }), 'collections.pages.fields.a.defaultValue');
		expect(() => fieldsOf({ a: f.text({ defaultValue: () => 'x' }), b: f.number({ defaultValue: () => 1 }) })).not.toThrow();
	});
});

describe('select', () => {
	it('normalizes options', () => {
		const s = fieldsOf({ a: f.select({ options: ['x', { label: 'Y!', value: 'y' }], defaultValue: 'y' }) }).fields[0];
		expect(s).toMatchObject({ options: [{ label: 'x', value: 'x' }, { label: 'Y!', value: 'y' }] });
	});
	it('rejects empty, duplicate, blank and bad defaults', () => {
		fails(() => fieldsOf({ a: f.select({ options: [] as never }) }), 'collections.pages.fields.a.options');
		fails(() => fieldsOf({ a: f.select({ options: ['x', 'x'] }) }), 'collections.pages.fields.a.options.1');
		fails(() => fieldsOf({ a: f.select({ options: [''] }) }), 'collections.pages.fields.a.options.0');
		fails(() => fieldsOf({ a: f.select({ options: ['x'], defaultValue: 'z' as never }) }), 'collections.pages.fields.a.defaultValue');
	});
});

describe('slug', () => {
	it('accepts a sibling text source (also across layout)', () => {
		expect(() => fieldsOf({ t: f.row({ fields: { title: f.text() } }), s: f.slug({ from: 'title' }) })).not.toThrow();
	});
	it('rejects missing or wrong-typed sources', () => {
		fails(() => fieldsOf({ s: f.slug({ from: 'nope' }) }), 'collections.pages.fields.s.from');
		fails(() => fieldsOf({ n: f.number(), s: f.slug({ from: 'n' }) }), 'collections.pages.fields.s.from');
	});
	it('does not see fields of other containers', () => {
		fails(() => fieldsOf({ title: f.text(), g: f.group({ fields: { s: f.slug({ from: 'title' }) } }) }), 'collections.pages.fields.g.fields.s.from');
	});
});

describe('relationship and upload', () => {
	const media = collection({ slug: 'media', upload: true, fields: {} });
	it('validates relationTo', () => {
		fails(() => fieldsOf({ a: f.relationship({ relationTo: 'ghost' }) }), 'collections.pages.fields.a.relationTo');
		fails(
			() => sanitize(page({ a: f.upload({ relationTo: 'pages' }) }), media),
			'collections.pages.fields.a.relationTo',
			/not an upload/,
		);
		const c = sanitize(page({ a: f.upload({ relationTo: 'media' }), b: f.relationship({ relationTo: 'users' }) }), media);
		expect(c.collectionsBySlug.pages!.fields[0]).toMatchObject({ relationTo: 'media', hasMany: false });
	});
	it('gates minRows/maxRows on hasMany', () => {
		fails(() => fieldsOf({ a: f.relationship({ relationTo: 'pages', minRows: 1 }) }), 'collections.pages.fields.a');
		fails(() => fieldsOf({ a: f.relationship({ relationTo: 'pages', hasMany: true, minRows: 3, maxRows: 1 }) }), 'collections.pages.fields.a');
		fails(() => fieldsOf({ a: f.relationship({ relationTo: 'pages', hasMany: true, maxRows: -1 }) }), 'collections.pages.fields.a.maxRows');
		expect(fieldsOf({ a: f.relationship({ relationTo: 'pages', hasMany: true, minRows: 1, maxRows: 3 }) }).fields[0]).toMatchObject({ hasMany: true, minRows: 1, maxRows: 3 });
	});
});

describe('group, array, blocks', () => {
	it('group recurses and is never required', () => {
		const g = fieldsOf({ g: f.group({ fields: { innerTitle: f.text() } }) }).fields[0]!;
		expect(g.type).toBe('group');
		if (g.type !== 'group') return;
		expect(g.required).toBe(false);
		expect(g.fields[0]).toMatchObject({ name: 'innerTitle', label: 'Inner title' });
		expect(g.layout).toEqual([{ kind: 'field', name: 'innerTitle' }]);
	});
	it('array has default labels and row bounds', () => {
		const a = fieldsOf({ links: f.array({ fields: { url: f.text() }, minRows: 1 }) }).fields[0]!;
		if (a.type !== 'array') throw new Error('type');
		expect(a.labels).toEqual({ singular: 'Row', plural: 'Links' });
		expect(a.minRows).toBe(1);
		fails(() => fieldsOf({ a: f.array({ fields: {}, minRows: 3, maxRows: 1 }) }), 'collections.pages.fields.a');
	});
	it('blocks sanitize blocks and enforce slug rules', () => {
		const hero = block({ slug: 'hero', fields: { heading: f.text({ required: true }) } });
		const b = fieldsOf({ sections: f.blocks({ blocks: [hero, block({ slug: 'call-out', fields: {} })] }) }).fields[0]!;
		if (b.type !== 'blocks') throw new Error('type');
		expect(b.labels).toEqual({ singular: 'Block', plural: 'Sections' });
		expect(b.blocks[0]).toMatchObject({ slug: 'hero', labels: { singular: 'Hero', plural: 'Heros' }, admin: {} });
		expect(b.blocks[0]!.fields[0]).toMatchObject({ name: 'heading', required: true });
		expect(b.blocks[1]!.labels.singular).toBe('Call out');
		fails(() => fieldsOf({ s: f.blocks({ blocks: [] as never }) }), 'collections.pages.fields.s.blocks');
		fails(() => fieldsOf({ s: f.blocks({ blocks: [hero, hero] }) }), 'collections.pages.fields.s.blocks.hero', /duplicate/);
		fails(() => fieldsOf({ s: f.blocks({ blocks: [block({ slug: '1x', fields: {} })] }) }), 'collections.pages.fields.s.blocks.1x');
	});
	it('reports deep paths', () => {
		fails(
			() =>
				fieldsOf({
					sections: f.blocks({ blocks: [block({ slug: 'hero', fields: { heading: f.text({ minLength: 3, maxLength: 1 }) } })] }),
				}),
			'collections.pages.fields.sections.blocks.hero.fields.heading',
		);
	});
});

describe('layout', () => {
	it('flattens and keeps the tree', () => {
		const c = fieldsOf({
			a: f.text(),
			r: f.row({ fields: { b: f.text(), c: f.text() } }),
			col: f.collapsible({ label: 'More', fields: { d: f.text() }, admin: { initCollapsed: true } }),
			t: f.tabs({
				tabs: [
					{ label: 'One', description: 'first', fields: { e: f.text() } },
					{ label: 'Two', fields: { nested: f.row({ fields: { g: f.text() } }) } },
				],
			}),
		});
		expect(c.fields.map((x) => x.name)).toEqual(['a', 'b', 'c', 'd', 'e', 'g']);
		expect(c.layout).toEqual([
			{ kind: 'field', name: 'a' },
			{ kind: 'row', children: [{ kind: 'field', name: 'b' }, { kind: 'field', name: 'c' }] },
			{ kind: 'collapsible', label: 'More', initCollapsed: true, children: [{ kind: 'field', name: 'd' }] },
			{
				kind: 'tabs',
				tabs: [
					{ label: 'One', description: 'first', children: [{ kind: 'field', name: 'e' }] },
					{ label: 'Two', children: [{ kind: 'row', children: [{ kind: 'field', name: 'g' }] }] },
				],
			},
		]);
	});
	it('defaults initCollapsed to false', () => {
		const c = fieldsOf({ col: f.collapsible({ label: 'X', fields: {} }) });
		expect(c.layout[0]).toMatchObject({ initCollapsed: false });
	});
	it('rejects empty labels and empty tabs', () => {
		fails(() => fieldsOf({ c: f.collapsible({ label: ' ', fields: {} }) }), 'collections.pages.fields.c.label');
		fails(() => fieldsOf({ t: f.tabs({ tabs: [] as never }) }), 'collections.pages.fields.t.tabs');
		fails(() => fieldsOf({ t: f.tabs({ tabs: [{ label: '', fields: {} }] }) }), 'collections.pages.fields.t.tabs.0.label');
	});
});

describe('upload collections', () => {
	it('adds built-ins and defaults', () => {
		const c = sanitize(collection({ slug: 'media', upload: { mimeTypes: ['image/*'] }, fields: { alt: f.text() } })).collectionsBySlug.media!;
		expect(c.upload).toEqual({ mimeTypes: ['image/*'], maxFileSize: 50 * 1024 * 1024 });
		expect(c.fields.map((x) => x.name)).toEqual(['filename', 'mimeType', 'filesize', 'width', 'height', 'key', 'alt']);
		expect(c.fields[0]).toMatchObject({ required: true, admin: { readOnly: true, position: 'sidebar' } });
		expect(c.fields[2]).toMatchObject({ type: 'number', integer: true, required: true });
		expect(c.fields[3]).toMatchObject({ required: false });
		expect(c.fields[5]).toMatchObject({ unique: true, admin: { hidden: true, readOnly: true } });
		expect(c.admin.useAsTitle).toBe('filename');
		expect(sanitize(page({})).collectionsBySlug.pages!.upload).toBe(false);
		expect(sanitize(collection({ slug: 'm', upload: true, fields: {} })).collectionsBySlug.m!.upload).toMatchObject({ mimeTypes: [] });
	});
	it('validates options', () => {
		fails(() => sanitize(collection({ slug: 'm', upload: { maxFileSize: 0 }, fields: {} })), 'collections.m.upload.maxFileSize');
		fails(() => sanitize(collection({ slug: 'm', upload: { maxFileSize: 1.5 }, fields: {} })), 'collections.m.upload.maxFileSize');
		fails(() => sanitize(collection({ slug: 'm', upload: { mimeTypes: ['png'] }, fields: {} })), 'collections.m.upload.mimeTypes');
	});
});

describe('auth collections', () => {
	it('prepends built-ins', () => {
		const u = sanitize(collection({ slug: 'staff', auth: true, fields: { bio: f.text() } })).collectionsBySlug.staff!;
		expect(u.fields.map((x) => x.name)).toEqual(['email', 'name', 'role', 'emailVerified', 'image', 'bio']);
		expect(u.fields[0]).toMatchObject({ type: 'email', required: true, unique: true });
		expect(u.fields[2]).toMatchObject({ type: 'select', required: true, defaultValue: 'editor', options: [{ value: 'admin' }, { value: 'editor' }] });
		expect(u.fields[3]).toMatchObject({ type: 'checkbox', admin: { hidden: true } });
		expect(u.fields[4]).toMatchObject({ type: 'text', admin: { hidden: true } });
		expect(u.auth).toBe(true);
	});
	it('replaces role with a custom select that includes admin and is required', () => {
		const u = sanitize(
			collection({ slug: 'users', auth: true, fields: { role: f.select({ options: ['admin', 'author'] }) } }),
		).collectionsBySlug.users!;
		expect(u.fields.filter((x) => x.name === 'role')).toHaveLength(1);
		expect(u.fields.find((x) => x.name === 'role')).toMatchObject({ required: true });
		fails(() => sanitize(collection({ slug: 'users', auth: true, fields: { role: f.select({ options: ['a'] }) } })), 'collections.users.fields.role.options');
		fails(() => sanitize(collection({ slug: 'users', auth: true, fields: { role: f.text() } })), 'collections.users.fields.role');
	});
	it('accepts admin.user when it matches', () => {
		expect(
			sanitizeConfig({ ...cfg(collection({ slug: 'staff', auth: true, fields: {} })), admin: { user: 'staff' } }).authCollection,
		).toBe('staff');
	});
});

describe('collection admin options', () => {
	it('defaults useAsTitle, columns and search', () => {
		expect(fieldsOf({ title: f.text() }).admin).toMatchObject({ useAsTitle: 'title', defaultColumns: ['title', 'updatedAt'], listSearchableFields: ['title'], hidden: false });
		expect(fieldsOf({ name: f.text() }).admin.useAsTitle).toBe('name');
		const none = fieldsOf({ n: f.number() }).admin;
		expect(none).toMatchObject({ useAsTitle: 'id', defaultColumns: ['id', 'updatedAt'], listSearchableFields: [] });
		expect(fieldsOf({ title: f.richText() }).admin.useAsTitle).toBe('id');
	});
	it('validates explicit options and copies description/group', () => {
		const c = fieldsOf({ a: f.text(), c: f.checkbox() }, { admin: { useAsTitle: 'a', description: 'd', group: 'g', defaultColumns: ['a', 'createdAt'], listSearchableFields: ['a'] } });
		expect(c.admin).toMatchObject({ description: 'd', group: 'g', defaultColumns: ['a', 'createdAt'] });
		fails(() => fieldsOf({ c: f.checkbox() }, { admin: { useAsTitle: 'c' } }), 'collections.pages.admin.useAsTitle');
		fails(() => fieldsOf({ a: f.text() }, { admin: { useAsTitle: 'zz' } }), 'collections.pages.admin.useAsTitle');
		fails(() => fieldsOf({ a: f.text() }, { admin: { defaultColumns: ['zz'] } }), 'collections.pages.admin.defaultColumns');
		fails(() => fieldsOf({ a: f.number() }, { admin: { listSearchableFields: ['a'] } }), 'collections.pages.admin.listSearchableFields');
	});
	it('validates defaultSort', () => {
		expect(fieldsOf({}).defaultSort).toBe('-createdAt');
		expect(fieldsOf({ a: f.text() }, { defaultSort: 'a' }).defaultSort).toBe('a');
		expect(fieldsOf({}, { defaultSort: '-updatedAt' }).defaultSort).toBe('-updatedAt');
		fails(() => fieldsOf({ a: f.json() }, { defaultSort: 'a' }), 'collections.pages.defaultSort');
		fails(() => fieldsOf({}, { defaultSort: '-zz' }), 'collections.pages.defaultSort');
	});
	it('normalizes collection hooks', () => {
		const h = () => undefined;
		const c = fieldsOf({}, { hooks: { beforeChange: h }, access: { read: () => true } });
		expect(c.hooks.beforeChange).toEqual([h]);
		expect(c.hooks.afterDelete).toEqual([]);
		expect(Object.keys(c.hooks)).toHaveLength(7);
		expect(c.access.read).toBeTypeOf('function');
		expect(fieldsOf({}).access).toEqual({});
	});
});

describe('toClientConfig', () => {
	const config = sanitize(
		collection({
			slug: 'pages',
			fields: {
				title: f.text({ required: true, defaultValue: () => 'x', validate: () => true, access: { read: () => true }, hooks: { beforeChange: () => undefined } }),
				shown: f.text({ admin: { condition: () => true, description: 'hi' } }),
				g: f.group({ fields: { inner: f.text({ validate: () => true }) } }),
				s: f.blocks({ blocks: [block({ slug: 'hero', admin: { preview: () => 1 }, fields: { h: f.text({ defaultValue: 'q' }) } })] }),
			},
			hooks: { beforeChange: () => undefined },
			access: { read: () => true },
		}),
	);
	const client = toClientConfig(config);
	it('strips functions and survives JSON', () => {
		expect(JSON.parse(JSON.stringify(client))).toEqual(client);
		const text = JSON.stringify(client);
		expect(text).not.toContain('validate');
		const pages = client.collections[0]!;
		expect(pages.access).toEqual({});
		expect(pages.hooks).toEqual({});
		const title = pages.fields[0]!;
		expect('defaultValue' in title).toBe(false);
		expect('hooks' in title).toBe(false);
		expect('access' in title).toBe(false);
	});
	it('maps condition to hasCondition and empties block admin', () => {
		const pages = client.collections[0]!;
		expect(pages.fields[1]!.admin).toEqual({ description: 'hi', hasCondition: true });
		const s = pages.fields[3]!;
		if (s.type !== 'blocks') throw new Error('type');
		expect(s.blocks[0]!.admin).toEqual({});
		expect('defaultValue' in s.blocks[0]!.fields[0]!).toBe(false);
		const g = pages.fields[2]!;
		if (g.type !== 'group') throw new Error('type');
		expect('validate' in g.fields[0]!).toBe(false);
		expect(client.authCollection).toBe('users');
	});
});
