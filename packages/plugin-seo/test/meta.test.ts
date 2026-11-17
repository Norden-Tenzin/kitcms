import { describe, expect, it } from 'vitest';
import { getMeta } from '../src';

describe('getMeta', () => {
	it('falls back title -> doc.title -> siteName', () => {
		expect(getMeta({ meta: { title: 'M' }, title: 'T' }).title).toBe('M');
		expect(getMeta({ meta: {}, title: 'T' }).title).toBe('T');
		expect(getMeta({}, { siteName: 'Site' }).title).toBe('Site');
		expect(getMeta({ name: 'N' }, { fallbackTitleField: 'name' }).title).toBe('N');
		expect(getMeta({}).title).toBe('');
	});
	it('applies the title template', () => {
		const d = { siteName: 'Site', titleTemplate: '%s | Site' };
		expect(getMeta({ title: 'About' }, d).title).toBe('About | Site');
		expect(getMeta({}, d).title).toBe('Site');
		expect(getMeta({ title: 'Site' }, d).title).toBe('Site');
		expect(getMeta({}, { titleTemplate: '%s | X' }).title).toBe('');
	});
	it('resolves description and image', () => {
		expect(getMeta({ meta: { description: 'd' } }, { description: 'x' }).description).toBe('d');
		expect(getMeta({}, { description: 'x' }).description).toBe('x');
		expect(getMeta({}).description).toBeNull();
		expect(getMeta({ meta: { image: { url: '/a.png' } } }).image).toBe('/a.png');
		expect(getMeta({ meta: { image: '01ABC' } }).image).toBeNull();
		expect(getMeta({ meta: { image: '01ABC' } }, { image: '/d.png' }).image).toBe('/d.png');
	});
	it('maps noIndex to robots and honours fieldName', () => {
		expect(getMeta({ meta: { noIndex: true } }).robots).toBe('noindex, nofollow');
		expect(getMeta({ meta: { noIndex: false } }).robots).toBe('index, follow');
		expect(getMeta({ seo: { noIndex: true } }, { fieldName: 'seo' }).robots).toBe('noindex, nofollow');
	});
	it('does not throw on garbage', () => {
		for (const doc of [null, undefined, 5, 'x', [], { meta: null }, { meta: 'x' }, { meta: [] }, { meta: { title: 5, image: 3 } }]) {
			expect(() => getMeta(doc as never)).not.toThrow();
		}
		expect(getMeta(null, null as never).robots).toBe('index, follow');
	});
});
