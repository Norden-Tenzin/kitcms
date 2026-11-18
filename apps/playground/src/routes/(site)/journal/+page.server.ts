import { designFor } from '#lib/site/content.ts';
import type { Post } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { site } = await parent();
	const { docs } = await locals.cms.find('posts', { depth: 1, limit: 50, sort: '-publishedAt', pagination: false });
	return { posts: docs as unknown as Post[], design: designFor('journal', site) };
};
