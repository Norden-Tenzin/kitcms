import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { Experience } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	const { docs } = await locals.cms.find('experiences', { depth: 1, limit: 50, pagination: false });
	const design = designFor('experiences', site, devPick(url));
	return { items: docs as unknown as Experience[], design };
};
