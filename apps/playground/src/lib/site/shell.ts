// The site "shell": everything the header, footer and sticky bar need, derived once from the `site`
// global. Pure (no server code), so the admin's site preview can use it too.
import { asDoc, asMedia, type Media } from './media';
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
	contact: {
		address: string;
		phone: string;
		whatsapp: string;
		email: string;
		mapUrl: string;
	};
	season: string;
	checkIn: string;
	checkOut: string;
	footerText: string;
	social: { id: string; label: string; url: string }[];
	announcement: { text: string; link: string } | null;
	legal: { title: string; slug: string }[];
}

export function buildShell(site: Site, legal: { title: string; slug: string }[]): Shell {
	const nav = (site.nav ?? []).flatMap((item): NavItem[] => {
		const target = asDoc<{ id: string; slug: string }>(item.page);
		const href = target ? (target.slug === 'home' ? '/' : `/${target.slug}`) : item.href;
		return href ? [{ id: item.id, label: item.label, href }] : [];
	});
	const c = site.contact ?? {};
	const a = site.announcement;
	return {
		siteName: site.siteName ?? 'Dolkar House',
		tagline: site.tagline ?? '',
		logo: asMedia(site.logo),
		nav,
		cta: { label: site.bookingCta?.label || 'Enquire', href: site.bookingCta?.href || '/contact' },
		contact: {
			address: c.address ?? '',
			phone: c.phone ?? '',
			whatsapp: c.whatsapp ?? '',
			email: c.email ?? '',
			mapUrl: c.mapUrl ?? '',
		},
		season: site.season ?? '',
		checkIn: site.checkIn ?? '',
		checkOut: site.checkOut ?? '',
		footerText: site.footerText ?? '',
		social: (site.social ?? []).map((s) => ({ id: s.id, label: s.label, url: s.url })),
		announcement: a?.enabled && a.text ? { text: a.text, link: a.link ?? '' } : null,
		legal,
	};
}

/** `tel:` href from a human phone number. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const waHref = (n: string) => `https://wa.me/${n.replace(/\D/g, '')}`;

/** Open April to October (Leh's tourist season). A small live fact: shown in the footer and hero. */
export function seasonStatus(now = new Date()): { open: boolean; text: string } {
	const m = now.getMonth(); // 0 = January
	if (m >= 3 && m <= 9) return { open: true, text: 'Open now for the season' };
	const days = Math.ceil((new Date(now.getFullYear() + (m >= 10 ? 1 : 0), 3, 1).getTime() - now.getTime()) / 864e5);
	return { open: false, text: `Closed for winter, opens in ${days} days` };
}

/** Allowed brand overrides become CSS variables. Anything that is not a hex colour is dropped. */
export function themeStyle(theme: Site['theme']): string {
	const hex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
	const out: string[] = [];
	const map: [string | null | undefined, string][] = [
		[theme?.accent, '--accent'],
		[theme?.ground, '--bg'],
		[theme?.ink, '--ink'],
	];
	for (const [v, name] of map) if (v && hex.test(v)) out.push(`${name}:${v}`);
	return out.join(';');
}
