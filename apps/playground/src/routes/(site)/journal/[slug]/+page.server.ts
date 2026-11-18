import { error } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import type { Post } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	const { site } = await parent();
	const found = await locals.cms.findOne('posts', { where: { slug: { equals: params.slug } }, depth: 2 });
	if (!found) error(404, 'Post not found');
	const post = found as unknown as Post;
	return { post, design: designFor('post', site, post.pageDesign) };
};
