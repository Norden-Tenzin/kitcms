import type { LayoutServerLoad } from './$types';

// Site settings (name, nav, footer, accent) for every public page. Anonymous reads are cached at
// the edge when `cache` is on in the config.
export const load: LayoutServerLoad = async ({ locals }) => ({
	site: await locals.cms.findGlobal('site', { depth: 1 }),
});
