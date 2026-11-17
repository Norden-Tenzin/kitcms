import type { PageServerLoad } from './$types';

// Reads through the Local API as the visitor: only published pages come back for anonymous users.
export const load: PageServerLoad = async ({ locals }) => {
	const { docs } = await locals.cms.find('pages', { sort: '-updatedAt', limit: 20 });
	return { pages: docs };
};
