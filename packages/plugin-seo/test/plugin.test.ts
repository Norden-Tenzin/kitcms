import { describe, expect, it } from 'vitest';
import { collection, defineConfig, fields as f, global } from '@kitcms/core';
import { sanitizeConfig } from '../../core/src/config/sanitize';
import { toTableSpecs } from '../../core/src/schema/tables';
import { seo } from '../src';

const pages = collection({ slug: 'pages', fields: { title: f.text({ required: true }) } } as never);
const posts = collection({ slug: 'posts', fields: { title: f.text() } } as never);
const media = collection({ slug: 'media', upload: true, fields: {} } as never);
const settings = global({ slug: 'settings', fields: { name: f.text() } } as never);
interface F {
	name: string;
	type: string;
	admin: { position?: string; description?: string };
	fields: F[];
}
const cfg = (opts: Parameters<typeof seo>[0]) =>
	defineConfig({ collections: [pages, posts, media], globals: [settings], plugins: [seo(opts)] } as never);

describe('seo plugin', () => {
	it('adds the meta group and a json column', () => {
		const c = sanitizeConfig(cfg({ collections: ['pages'], globals: ['settings'], uploadsCollection: 'media' }));
		const meta = c.collectionsBySlug.pages!.fields.find((x) => x.name === 'meta') as unknown as F;
		expect(meta.type).toBe('group');
		expect(meta.admin.position).toBe('sidebar');
		expect(meta.fields.map((x: F) => x.name)).toEqual(['title', 'description', 'image', 'noIndex']);
		expect(meta.fields[0]!.admin.description).toContain('60');
		expect(meta.fields[1]!.admin.description).toContain('160');
		expect(c.globalsBySlug.settings!.fields.some((x) => x.name === 'meta')).toBe(true);
		const specs = toTableSpecs(c);
		const col = specs.find((s) => s.name === 'pages')!.columns.find((x) => x.name === 'meta');
		expect(col).toBeTruthy();
	});

	it('omits image without uploadsCollection and honours options', () => {
		const c = sanitizeConfig(cfg({ collections: ['pages'], fieldName: 'seo', titleMaxLength: 50, descriptionMaxLength: 120 }));
		const g = c.collectionsBySlug.pages!.fields.find((x) => x.name === 'seo') as unknown as F;
		expect(g.fields.map((x: F) => x.name)).toEqual(['title', 'description', 'noIndex']);
		expect(g.fields[0]!.admin.description).toContain('50');
		expect(g.fields[1]!.admin.description).toContain('120');
	});

	it('leaves unlisted collections untouched and does not mutate input', () => {
		const input = cfg({ collections: ['pages'] });
		const before = JSON.stringify(Object.keys((input.collections![0] as unknown as { fields: object }).fields));
		const out = seo({ collections: ['pages'] }).config(input);
		expect(out.collections![1]).toBe(posts);
		expect(out.collections![0]).not.toBe(pages);
		expect(out.collections![0]!.slug).toBe('pages');
		expect(JSON.stringify(Object.keys((input.collections![0] as unknown as { fields: object }).fields))).toBe(before);
		expect(Object.keys((pages as unknown as { fields: object }).fields)).toEqual(['title']);
	});

	it('throws prefixed errors', () => {
		const run = (o: Parameters<typeof seo>[0]) => () => sanitizeConfig(cfg(o));
		expect(run({ collections: ['nope'] })).toThrow(/^seo: .*nope/);
		expect(run({ globals: ['nope'] })).toThrow(/^seo: .*nope/);
		expect(run({ collections: ['pages'], uploadsCollection: 'nope' })).toThrow(/^seo: /);
		expect(run({ collections: ['pages'], uploadsCollection: 'posts' })).toThrow(/^seo: .*not an upload/);
		expect(run({ collections: ['pages'], fieldName: 'title' })).toThrow(/^seo: .*already has a field/);
	});
});
