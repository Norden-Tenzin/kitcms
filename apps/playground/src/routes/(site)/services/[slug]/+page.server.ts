import { error } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { Project, Service } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const { site } = await parent();
	const found = await locals.cms.findOne('services', { where: { slug: { equals: params.slug } }, depth: 1 });
	if (!found) error(404, 'Service not found');
	const service = found as unknown as Service;
	const [related, others] = await Promise.all([
		locals.cms.find('projects', { where: { services: { contains: service.id } }, depth: 1, limit: 3, pagination: false }),
		locals.cms.find('services', { limit: 50, pagination: false }),
	]);
	return {
		service,
		projects: related.docs as unknown as Project[],
		others: (others.docs as unknown as Service[]).filter((s) => s.id !== service.id && s.slug),
		design: designFor('services', site, devPick(url)),
	};
};
