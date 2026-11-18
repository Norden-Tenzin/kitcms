import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { Post, Tag } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 9;

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	const tagSlug = (url.searchParams.get('tag') ?? '').slice(0, 80);
	const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1);
	const tags = (await locals.cms.find('tags', { sort: 'name', limit: 50, pagination: false })).docs as unknown as Tag[];
	// An unknown tag (a stale link) shows every post.
	const active = tagSlug ? (tags.find((t) => t.slug === tagSlug) ?? null) : null;
	const res = await locals.cms.find('posts', {
		where: active ? { tags: { contains: active.id } } : undefined,
		depth: 1,
		sort: '-publishedAt',
		limit: PAGE_SIZE,
		page,
	});
	return {
		posts: res.docs as unknown as Post[],
		tags: tags.flatMap((t) => (t.slug ? [{ name: t.name, slug: t.slug }] : [])),
		active: active?.slug ?? null,
		page: res.page,
		totalPages: res.totalPages,
		design: designFor('blog', site, devPick(url)),
	};
};
