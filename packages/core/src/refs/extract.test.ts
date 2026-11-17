import { describe, expect, it } from 'vitest';
import { array, blocks, group, rel, text, upload } from '../fields/test-fixtures';
import { extractRefs } from './extract';

const fields = [
	text('title'),
	rel('author', 'users'),
	rel('tags', 'tags', true),
	group('seo', [upload('image', 'media')]),
	array('rows', [upload('gallery', 'media', true)]),
	blocks('sections', [{ slug: 'hero', fields: [rel('link', 'pages')] }]),
];

describe('extractRefs', () => {
	it('extracts single, hasMany and nested refs in traversal order', () => {
		const refs = extractRefs(fields, {
			author: 'u1',
			tags: ['t1', 't2'],
			seo: { image: 'm1' },
			rows: [{ gallery: ['m2'] }, { gallery: ['m3', 'm4'] }],
			sections: [{ blockType: 'hero', link: 'p1' }],
		});
		expect(refs).toEqual([
			{ path: 'author', toCollection: 'users', toId: 'u1' },
			{ path: 'tags', toCollection: 'tags', toId: 't1' },
			{ path: 'tags', toCollection: 'tags', toId: 't2' },
			{ path: 'seo.image', toCollection: 'media', toId: 'm1' },
			{ path: 'rows.0.gallery', toCollection: 'media', toId: 'm2' },
			{ path: 'rows.1.gallery', toCollection: 'media', toId: 'm3' },
			{ path: 'rows.1.gallery', toCollection: 'media', toId: 'm4' },
			{ path: 'sections.0.link', toCollection: 'pages', toId: 'p1' },
		]);
	});

	it('skips empty values and non-string ids; dedupes', () => {
		expect(
			extractRefs(fields, {
				author: '',
				tags: ['t1', 't1', 5, null, ''],
				seo: { image: null },
				rows: [{ gallery: [] }, { gallery: 'bad' }],
			}),
		).toEqual([
			{ path: 'tags', toCollection: 'tags', toId: 't1' },
			{ path: 'rows.1.gallery', toCollection: 'media', toId: 'bad' },
		]);
		expect(extractRefs(fields, {})).toEqual([]);
	});
});
