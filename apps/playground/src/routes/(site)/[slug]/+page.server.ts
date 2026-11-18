import { error, redirect } from '@sveltejs/kit';
import { designFor, loadPage } from '#lib/site/content.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	// The home page lives at `/`.
	if (params.slug === 'home') redirect(308, '/');
	const { site } = await parent();
	const content = await loadPage(locals.cms, params.slug);
	if (!content) error(404, 'Page not found');
	const design = designFor('page', site, content.page.design);
	return { ...content, design, overHero: design === 'b' && content.blocks[0]?.blockType === 'hero' };
};
