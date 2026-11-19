import { building } from '$app/env';
import type { LayoutServerLoad } from './$types';

// Prerendered pages (the docs) are built without D1, so they get this fixed shell. Keep it in step
// with the seeded `site` global.
const GITHUB = 'https://github.com/Norden-Tenzin/kitcms';
const buildTimeSite = {
	siteName: 'kitcms',
	tagline: 'The CMS for SvelteKit on Cloudflare.',
	githubUrl: GITHUB,
	nav: [
		{ id: 'docs', label: 'Docs', href: '/docs' },
		{ id: 'blog', label: 'Changelog', href: '/blog' },
		{ id: 'github', label: 'GitHub', href: GITHUB },
	],
	footerColumns: [],
	footerNote: '',
	theme: null,
};

// Site settings (name, nav, footer, accent) for every public page. Anonymous reads are cached at
// the edge when `cache` is on in the config.
export const load: LayoutServerLoad = async ({ locals }) => ({
	site: building ? buildTimeSite : await locals.cms.findGlobal('site', { depth: 1 }),
});
