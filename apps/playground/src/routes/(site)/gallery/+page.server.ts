import { designFor } from '#lib/site/content.ts';
import type { Album } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { site } = await parent();
	const { docs } = await locals.cms.find('albums', { depth: 1, limit: 20, pagination: false });
	return { albums: docs as unknown as Album[], design: designFor('gallery', site) };
};
