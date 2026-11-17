import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import Admin from '../src/lib/Admin.svelte';
import { defineAdmin } from '../src/lib/preview/types';
import { clearRelationCache, fetchRelation, peekRelation } from '../src/lib/preview/relations';
import { collectBlocks } from '../src/lib/preview/blocks';
import type { AdminData, ClientCollection } from '@kitcms/core/client';

const text = (name: string) => ({
	type: 'text', name, label: name, required: false, index: false, unique: false, admin: {},
});
const hero = { slug: 'hero', labels: { singular: 'Hero', plural: 'Heroes' }, fields: [text('heading')], layout: [], admin: {} };
const cta = { slug: 'cta', labels: { singular: 'Call to action', plural: 'CTAs' }, fields: [text('label')], layout: [], admin: {} };

const pages = {
	kind: 'collection',
	slug: 'pages',
	labels: { singular: 'Page', plural: 'Pages' },
	fields: [
		text('title'),
		{ type: 'blocks', name: 'sections', label: 'Sections', required: false, admin: {}, blocks: [hero, cta], labels: { singular: 'Section', plural: 'Sections' } },
	],
	layout: [{ kind: 'field', name: 'title' }, { kind: 'field', name: 'sections' }],
	admin: { useAsTitle: 'title', defaultColumns: ['title'], listSearchableFields: [], hidden: false },
	defaultSort: '-createdAt',
	upload: false,
	auth: false,
	orderable: false,
	versions: false,
	access: {},
	hooks: {},
} as unknown as ClientCollection;

const data = (sections: unknown[]): AdminData =>
	({
		title: 'Test',
		branding: { colors: {} },
		user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' },
		nav: [{ slug: 'pages', label: 'Pages' }],
		globals: [],
		route: { view: 'edit', collection: 'pages', id: 'p1' },
		collection: pages,
		permissions: { create: true, update: true, delete: true },
		doc: { id: 'p1', title: 'Hello', sections },
		hiddenFields: [],
		isSelf: false,
	}) as unknown as AdminData;

describe('live preview: edit view SSR', () => {
	it('renders the pane placeholder, toggles, and never loads components on the server', () => {
		const loader = vi.fn(() => Promise.resolve({ default: (() => {}) as never }));
		const admin = defineAdmin({ previews: { blocks: { hero: loader } } });
		const { body } = render(Admin, {
			props: { data: data([{ id: 'b1', blockType: 'hero', heading: 'Hi' }, { id: 'b2', blockType: 'cta', label: 'Go' }]), admin },
		});
		expect(body).toContain('data-testid="preview-pane"');
		expect(body).toContain('Loading preview…');
		expect(body).toContain('data-testid="preview-toggle"');
		expect(body).toContain('data-testid="preview-desktop"');
		expect(body).toContain('data-testid="preview-mobile"');
		expect(body).toContain('kitcms-preview');
		expect(loader).not.toHaveBeenCalled();
	});

	it('renders a collection preview pane without any blocks', () => {
		const admin = defineAdmin({ previews: { collections: { pages: () => Promise.reject(new Error('no')) } } });
		const { body } = render(Admin, { props: { data: data([]), admin } });
		expect(body).toContain('data-testid="preview-pane"');
	});

	it('shows no pane when no preview applies', () => {
		for (const admin of [undefined, defineAdmin({}), defineAdmin({ previews: { blocks: { hero: () => Promise.reject() } } })]) {
			const { body } = render(Admin, {
				props: { data: data([{ id: 'b2', blockType: 'cta', label: 'Go' }]), admin },
			});
			expect(body).not.toContain('data-testid="preview-pane"');
			expect(body).not.toContain('data-testid="preview-toggle"');
		}
	});
});

describe('collectBlocks', () => {
	it('lists blocks in document order, including nested blocks', () => {
		const fields = pages.fields;
		const list = collectBlocks(fields, { sections: [{ id: 'a', blockType: 'cta' }, { id: 'b', blockType: 'hero' }] });
		expect(list.map((e) => [e.key, e.label])).toEqual([['a', 'Call to action'], ['b', 'Hero']]);
	});
});

describe('relation batching', () => {
	afterEach(() => {
		clearRelationCache();
		vi.unstubAllGlobals();
	});
	const stubFetch = () => {
		const fetchMock = vi.fn(async (url: string) => {
			const ids = new URL(url, 'http://x').searchParams.get('ids')!.split(',');
			const docs = ids.filter((i) => i !== 'gone').map((id) => ({ id, title: `T${id}`, url: `/f/${id}` }));
			return new Response(JSON.stringify({ docs }), { status: 200 });
		});
		vi.stubGlobal('fetch', fetchMock);
		return fetchMock;
	};

	it('batches lookups from the same microtask per collection and caches results', async () => {
		const fetchMock = stubFetch();
		const [a, b, c] = await Promise.all([
			fetchRelation('media', 'a'),
			fetchRelation('media', 'b'),
			fetchRelation('media', 'a'),
		]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]![0]).toContain('ids=a%2Cb');
		expect(a).toMatchObject({ id: 'a', url: '/f/a' });
		expect(c).toBe(a);
		expect(b!.id).toBe('b');
		expect(peekRelation('media', 'a')).toBe(a);
		await fetchRelation('media', 'a');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('uses one request per collection and caches misses', async () => {
		const fetchMock = stubFetch();
		const [m, p] = await Promise.all([fetchRelation('media', 'gone'), fetchRelation('pages', 'x')]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(m).toBeNull();
		expect(p!.id).toBe('x');
		expect(peekRelation('media', 'gone')).toBeNull();
	});

	it('does not cache failures', async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 500 }));
		vi.stubGlobal('fetch', fetchMock);
		await expect(fetchRelation('media', 'a')).rejects.toThrow();
		expect(peekRelation('media', 'a')).toBeUndefined();
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ docs: [{ id: 'a', title: 'A' }] })));
		expect((await fetchRelation('media', 'a'))!.title).toBe('A');
	});
});
