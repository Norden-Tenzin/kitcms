import { error } from '@sveltejs/kit';
import { designFor } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { Project } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	const { site } = await parent();
	const found = await locals.cms.findOne('projects', { where: { slug: { equals: params.slug } }, depth: 2 });
	if (!found) error(404, 'Project not found');
	const project = found as unknown as Project;

	const all = (await locals.cms.find('projects', { depth: 1, limit: 100, pagination: false })).docs as unknown as Project[];
	const at = all.findIndex((p) => p.id === project.id);
	const pick = (p: Project | undefined) =>
		p?.slug ? { slug: p.slug, title: p.title, client: p.client, year: p.year, cover: p.cover } : null;
	// Wraps around, so the last project links to the first.
	const next = all.length > 1 ? pick(all[(at + 1) % all.length]) : null;
	const prev = all.length > 1 ? pick(all[(at - 1 + all.length) % all.length]) : null;
	return { project, next, prev, design: designFor('project', site, devPick(url) ?? project.design) };
};
