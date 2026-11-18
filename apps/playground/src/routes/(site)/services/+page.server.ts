import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { Service } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	const res = await locals.cms.find('services', { depth: 1, limit: 50, pagination: false });
	return { services: res.docs as unknown as Service[], design: designFor('services', site, devPick(url)) };
};
