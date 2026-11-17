import { describe, expect, it } from 'vitest';
import { array, blocks, field, group, text } from './test-fixtures';
import { traverseFields, traverseFieldsSync } from './traverse';

const fields = [
	text('title'),
	group('seo', [text('metaTitle'), group('og', [text('image')])]),
	array('items', [text('label')]),
	blocks('sections', [
		{ slug: 'hero', fields: [text('heading')] },
		{ slug: 'cta', fields: [text('button')] },
	]),
];
const data = (): Record<string, unknown> => ({
	title: 'T',
	seo: { metaTitle: 'M', og: { image: 'i' } },
	items: [{ label: 'a' }, 'junk', { label: 'b' }],
	sections: [
		{ blockType: 'hero', heading: 'H' },
		{ blockType: 'nope', x: 1 },
		{ blockType: 'cta', button: 'B' },
	],
});

describe('traverseFields', () => {
	it('visits depth-first with paths', async () => {
		const paths: string[] = [];
		await traverseFields(fields, data(), ({ path }) => void paths.push(path));
		expect(paths).toEqual([
			'title',
			'seo',
			'seo.metaTitle',
			'seo.og',
			'seo.og.image',
			'items',
			'items.0.label',
			'items.2.label',
			'sections',
			'sections.0.heading',
			'sections.2.button',
		]);
	});

	it('sync twin matches', () => {
		const a: string[] = [];
		traverseFieldsSync(fields, data(), ({ path }) => void a.push(path));
		expect(a).toHaveLength(11);
		expect(a[6]).toBe('items.0.label');
	});

	it("'skip' skips descendants", async () => {
		const paths: string[] = [];
		await traverseFields(fields, data(), ({ path }) => {
			paths.push(path);
			if (path === 'seo' || path === 'items') return 'skip';
		});
		expect(paths).toEqual(['title', 'seo', 'items', 'sections', 'sections.0.heading', 'sections.2.button']);
		const s: string[] = [];
		traverseFieldsSync(fields, data(), ({ path }) => {
			s.push(path);
			return path === 'sections' ? 'skip' : undefined;
		});
		expect(s).not.toContain('sections.0.heading');
	});

	it('reads the value after visit (visitor may replace it)', async () => {
		const d = data();
		const paths: string[] = [];
		await traverseFields(fields, d, async ({ field: f, siblingData, path }) => {
			await Promise.resolve();
			if (f.name === 'seo') siblingData.seo = { metaTitle: 'new' };
			paths.push(path);
		});
		expect(paths).toContain('seo.metaTitle');
		expect(paths).not.toContain('seo.og.image');
	});

	it('honors pathPrefix and ignores non-object containers', async () => {
		const paths: string[] = [];
		await traverseFields([group('g', [text('a')]), array('r', [text('b')])], { g: 'x', r: null }, ({ path }) => void paths.push(path), 'root');
		expect(paths).toEqual(['root.g', 'root.r']);
		void field;
	});
});
