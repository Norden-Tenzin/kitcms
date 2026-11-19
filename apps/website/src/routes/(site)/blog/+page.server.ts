import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ locals, url }) => {
	const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1);
	// Published posts only (anonymous), newest first.
	const posts = await locals.cms.find('posts', {
		sort: '-publishedAt',
		limit: PAGE_SIZE,
		page,
		depth: 1,
	});
	if (page > 1 && posts.docs.length === 0) error(404, 'Page not found');
	// `slug` is filled from the title on save; the check only narrows its type.
	return {
		posts: { ...posts, docs: posts.docs.flatMap((d) => (d.slug ? [{ ...d, slug: d.slug }] : [])) },
	};
};
