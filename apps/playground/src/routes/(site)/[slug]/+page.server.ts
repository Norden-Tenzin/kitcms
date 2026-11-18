import { error, redirect } from '@sveltejs/kit';
import { designFor, loadPage } from '#lib/site/content.ts';
import { asMedia } from '#lib/site/media.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, parent, url }) => {
	// The home page lives at `/`.
	if (params.slug === 'home') redirect(308, '/');
	const { site } = await parent();
	const content = await loadPage(locals.cms, params.slug);
	if (!content) error(404, 'Page not found');
	const design = designFor('page', site, devPick(url) ?? content.page.design);
	// Vista floats the header over a hero block or, without one, over the page's own cover.
	const overHero = design === 'b' && (content.blocks[0]?.blockType === 'hero' || !!asMedia(content.page.cover));
	return { ...content, design, overHero };
};
