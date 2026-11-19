import { building } from '$app/env';
import { siteDefaultsWithIds } from '#lib/site-defaults.ts';
import type { LayoutServerLoad } from './$types';

// Site settings (name, nav, footer, accent) for every public page. Anonymous reads are cached at
// the edge when `cache` is on in the config. Prerendered pages (the docs) are built without D1, so
// they get the launch values instead (`site-defaults.ts`).
export const load: LayoutServerLoad = async ({ locals }) => ({
	site: building ? siteDefaultsWithIds() : await locals.cms.findGlobal('site', { depth: 1 }),
});
