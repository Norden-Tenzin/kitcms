// What the header and footer need, derived from the `site` global. Pure (no server code).
export interface NavItem {
	id: string;
	label: string;
	href: string;
}
export interface FooterColumn {
	id: string;
	title: string;
	links: NavItem[];
}

interface SiteLike {
	siteName?: string | null;
	tagline?: string | null;
	githubUrl?: string | null;
	nav?: { id: string; label: string; href?: string | null }[] | null;
	footerColumns?: {
		id: string;
		title: string;
		links?: { id: string; label: string; href?: string | null }[] | null;
	}[] | null;
	footerNote?: string | null;
}

export function buildShell(site: SiteLike) {
	return {
		siteName: site.siteName ?? 'kitcms',
		tagline: site.tagline ?? '',
		githubUrl: site.githubUrl ?? '',
		nav: (site.nav ?? []).map((n): NavItem => ({ id: n.id, label: n.label, href: n.href ?? '/' })),
		columns: (site.footerColumns ?? []).map(
			(c): FooterColumn => ({
				id: c.id,
				title: c.title,
				links: (c.links ?? []).map((l): NavItem => ({ id: l.id, label: l.label, href: l.href ?? '/' })),
			}),
		),
		note: site.footerNote ?? '',
	};
}
export type Shell = ReturnType<typeof buildShell>;

/** Is `href` the current page (or a section of it)? Used for `aria-current`. */
export const isActive = (href: string, pathname: string) =>
	href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
