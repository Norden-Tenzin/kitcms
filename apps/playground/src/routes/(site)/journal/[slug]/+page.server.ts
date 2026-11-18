import { error } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { Post } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const { site } = await parent();
	const found = await locals.cms.findOne('posts', { where: { slug: { equals: params.slug } }, depth: 2 });
	if (!found) error(404, 'Post not found');
	const post = found as unknown as Post;

	// Newest first: "newer" is the one before, "older" the one after.
	const all = (await locals.cms.find('posts', { depth: 1, sort: '-publishedAt', limit: 100, pagination: false })).docs as unknown as Post[];
	const at = all.findIndex((p) => p.id === post.id);
	const pick = (p: Post | undefined) => (p?.slug ? { slug: p.slug, title: p.title, cover: p.cover, publishedAt: p.publishedAt } : null);
	const newer = at > 0 ? pick(all[at - 1]) : null;
	const older = at >= 0 ? pick(all[at + 1]) : null;
	const related = all.filter((p) => p.id !== post.id).slice(0, 3);

	const design = designFor('post', site, devPick(url) ?? post.pageDesign);
	return { post, newer, older, related, design, overHero: design === 'b' };
};
