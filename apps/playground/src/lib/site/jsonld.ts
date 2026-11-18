// schema.org structured data (JSON-LD) for the hotel and its rooms.
import { asMedia, asMediaList } from './media';
import type { Shell } from './shell';
import type { Room } from './types';

const abs = (origin: string, url: string) => new URL(url, origin).href;

export function hotelLd(shell: Shell, origin: string, imageUrl?: string | null) {
	const [street = '', city = ''] = shell.contact.address.split('\n');
	return {
		'@context': 'https://schema.org',
		'@type': 'Hotel',
		name: shell.siteName,
		description: shell.tagline || undefined,
		url: origin,
		image: imageUrl ? abs(origin, imageUrl) : undefined,
		telephone: shell.contact.phone || undefined,
		email: shell.contact.email || undefined,
		checkinTime: shell.checkIn || undefined,
		checkoutTime: shell.checkOut || undefined,
		numberOfRooms: 12,
		address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: city, addressCountry: 'IN' },
	};
}

export function roomLd(room: Room, shell: Shell, origin: string) {
	const cover = asMedia(room.cover) ?? asMediaList(room.gallery)[0];
	return {
		'@context': 'https://schema.org',
		'@type': 'HotelRoom',
		name: room.name,
		description: room.summary || undefined,
		image: cover ? abs(origin, cover.url) : undefined,
		bed: room.beds ? { '@type': 'BedDetails', typeOfBed: room.beds } : undefined,
		occupancy: room.maxGuests ? { '@type': 'QuantitativeValue', maxValue: room.maxGuests } : undefined,
		floorSize: room.sizeSqm ? { '@type': 'QuantitativeValue', value: room.sizeSqm, unitCode: 'MTK' } : undefined,
		amenityFeature: (room.amenities ?? []).map((a) => ({ '@type': 'LocationFeatureSpecification', name: a.label, value: true })),
		containedInPlace: { '@type': 'Hotel', name: shell.siteName, url: origin },
		offers: room.priceFrom ? { '@type': 'Offer', priceCurrency: 'INR', price: room.priceFrom } : undefined,
	};
}
