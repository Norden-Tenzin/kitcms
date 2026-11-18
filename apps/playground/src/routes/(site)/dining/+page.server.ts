import { designFor } from '#lib/site/content.ts';
import type { Dish } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { site } = await parent();
	const { docs } = await locals.cms.find('dishes', { limit: 100, pagination: false });
	return { dishes: docs as unknown as Dish[], design: designFor('dining', site) };
};
