import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { Project, Service } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	const slug = (url.searchParams.get('service') ?? '').slice(0, 80);
	const services = (await locals.cms.find('services', { limit: 50, pagination: false })).docs as unknown as Service[];
	// An unknown service (a stale link) shows all the work.
	const active = slug ? (services.find((s) => s.slug === slug) ?? null) : null;
	const res = await locals.cms.find('projects', {
		where: active ? { services: { contains: active.id } } : undefined,
		depth: 1,
		limit: 60,
		pagination: false,
	});
	return {
		projects: res.docs as unknown as Project[],
		filters: services.flatMap((s) => (s.slug ? [{ title: s.title, slug: s.slug }] : [])),
		active: active?.slug ?? null,
		design: designFor('work', site, devPick(url)),
	};
};
