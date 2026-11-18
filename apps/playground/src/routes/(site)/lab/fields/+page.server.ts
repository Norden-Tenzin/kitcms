import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { docs } = await locals.cms.find('kitchen-sink', { sort: 'title', limit: 50, pagination: false });
	return { docs: docs.map((d) => ({ id: d.id, title: String(d.title ?? ''), slug: String(d.slug ?? '') })) };
};
