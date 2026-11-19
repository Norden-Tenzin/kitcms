import { error } from '@sveltejs/kit';
import { pages } from 'virtual:kitcms-docs';
import paths from 'virtual:kitcms-docs-paths';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => paths.map((p) => ({ slug: p.replace(/^\/docs\//, '') }));

export const load: PageServerLoad = ({ params }) => {
	const path = `/docs/${params.slug}`;
	const page = Object.hasOwn(pages, path) ? pages[path] : undefined;
	if (!page) error(404, 'Page not found');
	return { path, page };
};
