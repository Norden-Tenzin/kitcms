// schema.org structured data (JSON-LD) for the studio.
import type { Shell } from './shell';

const abs = (origin: string, url: string) => new URL(url, origin).href;

export function organizationLd(shell: Shell, origin: string, imageUrl?: string | null) {
	const [street = '', city = ''] = shell.contact.address.split('\n');
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: shell.siteName,
		description: shell.tagline || undefined,
		url: origin,
		logo: shell.logo ? abs(origin, shell.logo.url) : undefined,
		image: imageUrl ? abs(origin, imageUrl) : undefined,
		email: shell.contact.email || undefined,
		telephone: shell.contact.phone || undefined,
		address: shell.contact.address
			? { '@type': 'PostalAddress', streetAddress: street, addressLocality: city, addressCountry: 'IN' }
			: undefined,
		sameAs: shell.social.map((s) => s.url),
	};
}
