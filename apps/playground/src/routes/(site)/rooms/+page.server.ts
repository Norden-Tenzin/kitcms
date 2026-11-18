import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { Room } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	const { docs } = await locals.cms.find('rooms', { depth: 1, limit: 50, pagination: false });
	return { rooms: docs as unknown as Room[], design: designFor('rooms', site, devPick(url)) };
};
