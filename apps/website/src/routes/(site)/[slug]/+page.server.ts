import { error, redirect } from '@sveltejs/kit';
import { loadPage } from '#lib/content.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	// The home page lives at `/`.
	if (params.slug === 'home') redirect(308, '/');
	const content = await loadPage(locals.cms, params.slug);
	if (!content) error(404, 'Page not found');
	return { content };
};
