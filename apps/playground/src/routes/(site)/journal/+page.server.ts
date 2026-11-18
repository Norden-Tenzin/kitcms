import { redirect } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { Post, Tag } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 9;

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	const tagSlug = (url.searchParams.get('tag') ?? '').slice(0, 80);
	const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1);

	const tags = (await locals.cms.find('tags', { sort: 'name', limit: 50, pagination: false })).docs as unknown as Tag[];
	const active = tagSlug ? (tags.find((t) => t.slug === tagSlug) ?? null) : null;
	// An unknown tag (a stale link) shows the whole journal.
	if (tagSlug && !active) redirect(307, '/journal');

	const res = await locals.cms.find('posts', {
		where: active ? { tags: { contains: active.id } } : undefined,
		depth: 1,
		sort: '-publishedAt',
		limit: PAGE_SIZE,
		page,
	});
	const design = designFor('journal', site, devPick(url));
	return {
		posts: res.docs as unknown as Post[],
		tags: tags.flatMap((t) => (t.slug ? [{ name: t.name, slug: t.slug }] : [])),
		activeTag: active?.slug ? { name: active.name, slug: active.slug } : null,
		page: res.page,
		totalPages: res.totalPages,
		totalDocs: res.totalDocs,
		design,
		overHero: design === 'b' && page === 1 && !!res.docs[0],
	};
};
