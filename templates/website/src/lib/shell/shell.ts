// The site "shell": what the header and footer need, derived once from the `site` global and the
// legal pages. Pure (no server code).
import { asDoc, asMedia, type Media } from '../media';

export interface NavItem {
	id: string;
	label: string;
	href: string;
}
export interface Shell {
	siteName: string;
	tagline: string;
	logo: Media | null;
	nav: NavItem[];
	footerText: string;
	social: { id: string; label: string; url: string }[];
	legal: { title: string; slug: string }[];
}

/** The part of the `site` global the shell reads (loosely typed: upload and relationship fields are ids or documents). */
interface SiteLike {
	siteName?: string | null;
	tagline?: string | null;
	logo?: unknown;
	nav?: { id: string; label: string; page?: unknown; href?: string | null }[] | null;
	footer?: {
		text?: string | null;
		social?: { id: string; label: string; url: string }[] | null;
	} | null;
}

export function buildShell(site: SiteLike, legal: { title: string; slug: string }[]): Shell {
	// A nav item points to a page (populated at depth 1) or, without one, to a path like `/blog`.
	const nav = (site.nav ?? []).flatMap((item): NavItem[] => {
		const target = asDoc<{ id: string; slug: string }>(item.page);
		const href = target ? (target.slug === 'home' ? '/' : `/${target.slug}`) : item.href;
		return href ? [{ id: item.id, label: item.label, href }] : [];
	});
	return {
		siteName: site.siteName ?? 'My site',
		tagline: site.tagline ?? '',
		logo: asMedia(site.logo),
		nav,
		footerText: site.footer?.text ?? '',
		social: (site.footer?.social ?? []).map((s) => ({ id: s.id, label: s.label, url: s.url })),
		legal,
	};
}

/** Is `href` the current page (or a section of it)? Used for `aria-current`. */
export const isActive = (href: string, pathname: string) =>
	href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
