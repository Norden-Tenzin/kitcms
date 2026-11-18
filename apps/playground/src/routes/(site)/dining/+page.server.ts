import { designFor, loadPage } from '#lib/site/content.ts';
import { devPick } from '#lib/site/pages/devDesign.ts';
import type { Dish } from '#lib/site/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { site } = await parent();
	const [dishes, content] = await Promise.all([
		locals.cms.find('dishes', { limit: 100, pagination: false }),
		// The `dining` page (slug) supplies the intro, the "how dinner works" list and the pictures.
		loadPage(locals.cms, 'dining'),
	]);
	const design = designFor('dining', site, devPick(url));
	return {
		dishes: dishes.docs as unknown as Dish[],
		page: content?.page ?? null,
		blocks: content?.blocks ?? [],
		design,
		overHero: design === 'b',
	};
};
