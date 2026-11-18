import { designFor, loadPage } from '#lib/site/content.ts';
import { devPick } from '#lib/site/devDesign.ts';
import type { PageServerLoad } from './$types';

// `/` is the page with the slug `home`, in the `home` design. Without one (an empty database) a hint shows.
export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const [{ site }, content] = await Promise.all([parent(), loadPage(locals.cms, 'home')]);
	return { content, design: designFor('home', site, devPick(url) ?? content?.page.design) };
};
