// The launch values of the `site` global. Used by the seed (a fresh D1) and as the header/footer of
// prerendered pages (the docs are built without D1, so they can't read the global). After launch the
// CMS is the source of truth for other pages; keep this in step when the nav or footer changes.
export const GITHUB = 'https://github.com/Norden-Tenzin/kitcms';
export const NPM = 'https://www.npmjs.com/package/create-kitcms';

export const siteDefaults = {
	siteName: 'kitcms',
	tagline: 'The CMS for SvelteKit on Cloudflare.',
	githubUrl: GITHUB,
	npmUrl: NPM,
	nav: [
		{ label: 'Docs', href: '/docs' },
		{ label: 'Changelog', href: '/blog' },
		{ label: 'GitHub', href: GITHUB },
	],
	footerColumns: [
		{
			title: 'Docs',
			links: [
				{ label: 'Getting started', href: '/docs/getting-started' },
				{ label: 'Configuration', href: '/docs/configuration' },
				{ label: 'Deploy', href: '/docs/deploy' },
			],
		},
		{
			title: 'Project',
			links: [
				{ label: 'GitHub', href: GITHUB },
				{ label: 'npm', href: NPM },
				{ label: 'Changelog', href: '/blog' },
				{ label: 'License', href: `${GITHUB}/blob/main/LICENSE` },
			],
		},
	],
	footerNote: 'MIT licensed. This site is a kitcms app running on Cloudflare Workers.',
};

/** `siteDefaults` shaped like a stored global (array rows have ids), for the build-time shell. */
export function siteDefaultsWithIds() {
	return {
		...siteDefaults,
		nav: siteDefaults.nav.map((n, i) => ({ id: `nav-${i}`, ...n })),
		footerColumns: siteDefaults.footerColumns.map((c, i) => ({
			id: `col-${i}`,
			title: c.title,
			links: c.links.map((l, j) => ({ id: `col-${i}-${j}`, ...l })),
		})),
		theme: null,
	};
}
