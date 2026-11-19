import { error } from '@sveltejs/kit';
import { loadPage } from '#lib/content.ts';
import type { PageServerLoad } from './$types';

// `/` is the page with the slug `home`.
export const load: PageServerLoad = async ({ locals }) => {
	const content = await loadPage(locals.cms, 'home');
	if (!content) error(404, 'No published page with the slug "home" yet. Run pnpm db:seed.');
	return { content };
};
