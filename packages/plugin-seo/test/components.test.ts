import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { SeoHead, SerpPreview } from '../src/svelte';
import { getMeta } from '../src';

describe('SeoHead', () => {
	it('renders head tags', () => {
		const meta = getMeta({ meta: { title: 'Hi', description: 'Desc', image: { url: 'https://x/i.png' } } });
		const { head } = render(SeoHead, { props: { meta, url: 'https://x/p', siteName: 'Site' } });
		expect(head).toContain('<title>Hi</title>');
		expect(head).toContain('name="description" content="Desc"');
		expect(head).toContain('name="robots" content="index, follow"');
		expect(head).toContain('property="og:image" content="https://x/i.png"');
		expect(head).toContain('property="og:url" content="https://x/p"');
		expect(head).toContain('property="og:site_name" content="Site"');
		expect(head).toContain('content="summary_large_image"');
	});
	it('uses summary without an image and omits empty tags', () => {
		const { head } = render(SeoHead, { props: { meta: getMeta({ title: 'A' }) } });
		expect(head).toContain('content="summary"');
		expect(head).not.toContain('og:image');
		expect(head).not.toContain('name="description"');
	});
	it('escapes values', () => {
		const { head } = render(SeoHead, { props: { meta: getMeta({ title: '<script>alert(1)</script>', meta: { description: '"><script>x</script>' } }) } });
		expect(head).not.toContain('<script>');
		expect(head).toContain('&lt;script>');
	});
});

describe('SerpPreview', () => {
	it('renders title, url and description', () => {
		const { body } = render(SerpPreview, { props: { doc: { title: 'Page', meta: { description: 'Hello' } }, url: 'example.com/page' } });
		expect(body).toContain('Page');
		expect(body).toContain('example.com/page');
		expect(body).toContain('Hello');
		expect(body).not.toContain('over the recommended length');
	});
	it('truncates and hints when too long, and escapes', () => {
		const { body } = render(SerpPreview, { props: { doc: { title: '<script>x</script>' + 'a'.repeat(80), meta: { description: 'd'.repeat(200) } } } });
		expect(body).not.toContain('<script>');
		expect(body).toContain('…');
		expect(body).toContain('over the recommended length (60)');
		expect(body).toContain('over the recommended length (160)');
	});
	it('applies defaults', () => {
		const { body } = render(SerpPreview, { props: { doc: {}, defaults: { siteName: 'Acme' } } });
		expect(body).toContain('Acme');
	});
});
