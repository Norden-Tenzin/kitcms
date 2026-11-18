import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const doc = await locals.cms.findOne('legal', { where: { slug: { equals: params.slug } } });
	if (!doc) error(404, 'Page not found');
	return { doc };
};
