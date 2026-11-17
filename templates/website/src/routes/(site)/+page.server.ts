import { loadPage } from '#lib/content.ts';
import type { PageServerLoad } from './$types';

// `/` is the page with the slug `home`. Without one (a fresh install) the template shows a hint.
export const load: PageServerLoad = async ({ locals }) => ({
	content: await loadPage(locals.cms, 'home'),
});
