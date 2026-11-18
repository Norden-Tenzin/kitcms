import { error, redirect } from '@sveltejs/kit';
import { designFor, loadPage } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	// The home page lives at `/`.
	if (params.slug === 'home') redirect(308, '/');
	const [{ site }, content] = await Promise.all([parent(), loadPage(locals.cms, params.slug)]);
	if (!content) error(404, 'Page not found');
	return { content, design: designFor('page', site, devPick(url) ?? content.page.design) };
};
