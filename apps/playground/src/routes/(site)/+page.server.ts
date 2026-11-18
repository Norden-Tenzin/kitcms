import type { PageServerLoad } from './$types';

// A public page reading through the Local API as the anonymous visitor.
export const load: PageServerLoad = async ({ locals }) => {
	const { docs } = await locals.cms.find('pages', { sort: '-updatedAt', limit: 20, depth: 1 });
	return { pages: docs };
};
