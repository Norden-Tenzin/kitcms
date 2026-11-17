import type { LayoutServerLoad } from './$types';

// Site settings (name, nav, footer) and the legal pages for every public page. `depth: 1`
// populates the logo and the pages the nav links to. Anonymous reads are cached at the edge when
// `cache` is on in the config.
export const load: LayoutServerLoad = async ({ locals }) => {
	const [site, legal] = await Promise.all([
		locals.cms.findGlobal('site', { depth: 1 }),
		locals.cms.find('legal', { sort: 'title', limit: 20, pagination: false }),
	]);
	return { site, legal: legal.docs.map((d) => ({ title: d.title, slug: d.slug })) };
};
