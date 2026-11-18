import { designFor, loadPage } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	// The `contact` page (slug) supplies the getting-there notes, the altitude advice and the picture.
	const content = await loadPage(locals.cms, 'contact');
	const design = designFor('contact', site, devPick(url));
	return { page: content?.page ?? null, blocks: content?.blocks ?? [], design, overHero: design === 'b' };
};
