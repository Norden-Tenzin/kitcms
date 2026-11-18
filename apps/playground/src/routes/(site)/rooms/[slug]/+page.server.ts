import { error } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { Room } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const { site } = await parent();
	const found = await locals.cms.findOne('rooms', { where: { slug: { equals: params.slug } }, depth: 1 });
	if (!found) error(404, 'Room not found');
	const room = found as unknown as Room;
	const all = await locals.cms.find('rooms', { depth: 1, limit: 50, pagination: false });
	const others = (all.docs as unknown as Room[]).filter((r) => r.id !== room.id);
	const design = designFor('room', site, devPick(url) ?? room.pageDesign);
	return { room, others, design, overHero: design === 'b' };
};
