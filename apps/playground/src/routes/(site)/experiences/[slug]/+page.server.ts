import { error } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { Experience } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const { site } = await parent();
	const found = await locals.cms.findOne('experiences', { where: { slug: { equals: params.slug } }, depth: 1 });
	if (!found) error(404, 'Experience not found');
	const item = found as unknown as Experience;
	const all = await locals.cms.find('experiences', { depth: 1, limit: 50, pagination: false });
	const others = (all.docs as unknown as Experience[]).filter((e) => e.id !== item.id);
	const design = designFor('experience', site, devPick(url) ?? item.pageDesign);
	return { item, others, design, overHero: design === 'b' };
};
