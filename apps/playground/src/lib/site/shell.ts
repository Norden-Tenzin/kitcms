// The site "shell": what the header, footer and menus need, derived once from the `site` global and
// the legal pages. Pure (no server code), so the admin's site preview can use it too.
import { asDoc, asMedia, type Media } from './media';
import { isHex } from './designs';
import type { Site } from './types';

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
	cta: { label: string; href: string };
	contact: { email: string; phone: string; address: string; hours: string; mapUrl: string };
	footerText: string;
	social: { id: string; label: string; url: string }[];
	announcement: { text: string; link: string } | null;
	legal: { title: string; slug: string }[];
}

export function buildShell(site: Site, legal: { title: string; slug: string }[]): Shell {
	// A nav item points to a page (populated at depth 1) or, without one, to a path like `/work`.
	const nav = (site.nav ?? []).flatMap((item): NavItem[] => {
		const target = asDoc<{ id: string; slug: string }>(item.page);
		const href = target ? (target.slug === 'home' ? '/' : `/${target.slug}`) : item.href;
		return href ? [{ id: item.id, label: item.label, href }] : [];
	});
	const c = site.contact ?? {};
	const a = site.announcement;
	return {
		siteName: site.siteName ?? 'Halden Studio',
		tagline: site.tagline ?? '',
		logo: asMedia(site.logo),
		nav,
		cta: { label: site.cta?.label || 'Start a project', href: site.cta?.href || '/contact' },
		contact: {
			email: c.email ?? '',
			phone: c.phone ?? '',
			address: c.address ?? '',
			hours: c.hours ?? '',
			mapUrl: c.mapUrl ?? '',
		},
		footerText: site.footerText ?? '',
		social: (site.social ?? []).map((s) => ({ id: s.id, label: s.label, url: s.url })),
		announcement: a?.enabled && a.text ? { text: a.text, link: a.link ?? '' } : null,
		legal,
	};
}

/** `tel:` href from a human phone number. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Is `href` the current page (or a section of it)? Used for `aria-current`. */
export const isActive = (href: string, pathname: string) =>
	href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

const expand = (hex: string) =>
	hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
/** Relative luminance of a validated hex colour (0 = black, 1 = white). */
function luminance(hex: string): number {
	const h = expand(hex);
	const ch = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
	const [r = 0, g = 0, b = 0] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The editor's colour overrides as CSS variables. Anything that is not a hex colour is dropped
 * (it would end up in a `style` attribute). Surface, muted and line colours are derived in CSS.
 */
export function themeStyle(theme: Site['theme']): string {
	const out: string[] = [];
	if (isHex(theme?.accent)) {
		out.push(`--accent:${theme.accent}`);
		// Text on the accent: white or near-black, whichever contrasts more.
		out.push(`--accent-ink:${luminance(theme.accent) > 0.4 ? '#161716' : '#ffffff'}`);
	}
	if (isHex(theme?.background)) out.push(`--bg:${theme.background}`);
	if (isHex(theme?.text)) out.push(`--ink:${theme.text}`);
	return out.join(';');
}
