import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const post = await locals.cms.findOne('posts', {
		where: { slug: { equals: params.slug } },
		depth: 1,
	});
	if (!post) error(404, 'Post not found');
	return { post };
};
