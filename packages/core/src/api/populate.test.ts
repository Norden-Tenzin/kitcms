import { describe, expect, it } from 'vitest';
import { array, blocks, group, rel, text, upload } from '../fields/test-fixtures';
import { collectRelationIds, replaceRelationIds } from './populate';

const fields = [
	text('title'),
	rel('author', 'users'),
	rel('tags', 'tags', true),
	group('seo', [upload('image', 'media')]),
	array('rows', [upload('gallery', 'media', true)]),
	blocks('sections', [{ slug: 'hero', fields: [rel('link', 'pages')] }]),
];
const doc = () => ({
	title: 'x',
	author: 'u1',
	tags: ['t1', 't2'],
	seo: { image: 'm1' },
	rows: [{ gallery: ['m2', 'm3'] }],
	sections: [{ blockType: 'hero', link: 'p1' }],
});

describe('collectRelationIds', () => {
	it('groups ids by collection across docs', () => {
		const other = { author: 'u2', tags: ['t1'], seo: { image: 'm1' } };
		const out = collectRelationIds(fields, [doc(), other]);
		expect(out.get('users')).toEqual(new Set(['u1', 'u2']));
		expect(out.get('tags')).toEqual(new Set(['t1', 't2']));
		expect(out.get('media')).toEqual(new Set(['m1', 'm2', 'm3']));
		expect(out.get('pages')).toEqual(new Set(['p1']));
	});
	it('accumulates into a provided map', () => {
		const map = new Map([['users', new Set(['u0'])]]);
		const out = collectRelationIds(fields, [doc()], map);
		expect(out).toBe(map);
		expect(out.get('users')).toEqual(new Set(['u0', 'u1']));
	});
});

describe('replaceRelationIds', () => {
	const lookup = (c: string, id: string) =>
		id === 't2' || id === 'm3' ? undefined : { id, collection: c };
	it('replaces hits, keeps misses, preserves order, does not mutate', () => {
		const input = doc();
		const snapshot = structuredClone(input);
		const out = replaceRelationIds(fields, input, lookup);
		expect(input).toEqual(snapshot);
		expect(out.author).toEqual({ id: 'u1', collection: 'users' });
		expect(out.tags).toEqual([{ id: 't1', collection: 'tags' }, 't2']);
		expect(out.seo).toEqual({ image: { id: 'm1', collection: 'media' } });
		expect(out.rows).toEqual([{ gallery: [{ id: 'm2', collection: 'media' }, 'm3'] }]);
		expect(out.sections).toEqual([{ blockType: 'hero', link: { id: 'p1', collection: 'pages' } }]);
		expect(out).not.toBe(input);
		expect(out.seo).not.toBe(input.seo);
	});
	it('tolerates missing and odd values', () => {
		const out = replaceRelationIds(fields, { author: null, seo: 'x', rows: [1], sections: [{ blockType: 'q' }] }, lookup);
		expect(out).toEqual({ author: null, seo: 'x', rows: [1], sections: [{ blockType: 'q' }] });
	});
});
