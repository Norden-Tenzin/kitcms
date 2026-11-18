import type { Media } from '#lib/site/media.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { docs } = await locals.cms.find('media', { limit: 200, pagination: false, sort: 'filename' });
	return { credits: (docs as unknown as Media[]).filter((m) => m.credit) };
};
