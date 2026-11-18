import { error } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import type { Experience } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	const { site } = await parent();
	const found = await locals.cms.findOne('experiences', { where: { slug: { equals: params.slug } }, depth: 1 });
	if (!found) error(404, 'Experience not found');
	const item = found as unknown as Experience;
	return { item, design: designFor('experience', site, item.pageDesign) };
};
