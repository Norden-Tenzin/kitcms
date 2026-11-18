import { error } from '@sveltejs/kit';
import { designFor, loadPage } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { PageServerLoad } from './$types';

// The home page is the `pages` document with slug `home`. Its design comes from the site's Design tab.
export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	const content = await loadPage(locals.cms, 'home');
	if (!content) error(404, 'The home page has not been created yet. Run `pnpm db:seed`.');
	const design = designFor('home', site, devPick(url) ?? content.page.design);
	// Header design C floats over a photograph only when the hero is one (design B).
	const overHero = design === 'b' && content.blocks[0]?.blockType === 'hero';
	return { ...content, design, overHero };
};
