// Idempotent seed: `pnpm db:seed` (local) or `kitcms seed --remote`. Existing documents are never
// overwritten, so it is safe to run again after editors changed things. It builds the whole Dolkar
// House demo: photographs (seed/images, credits in seed/CREDITS.md), rooms, experiences, journal,
// testimonials, FAQs, dishes, offers, albums, the pages and the site settings.
import { defineSeed } from '@kitcms/core';
import images from '../seed/images.json';
import { ALBUMS, DISHES, EXPERIENCES, FAQS, LEGAL, OFFERS, POSTS, ROOMS, TAGS, TEAM, TESTIMONIALS } from '../seed/data';
import { h2, p, rt, ul } from '../seed/rt';

type ImageKey = keyof typeof images;

export default defineSeed(async ({ ensure, ensureGlobal, ensureUpload, cms, log }) => {
	// ----- Pictures --------------------------------------------------------------------------------
	const media = {} as Record<ImageKey, string>;
	for (const [key, img] of Object.entries(images) as [ImageKey, (typeof images)[ImageKey]][]) {
		const doc = await ensureUpload('media', {
			where: { filename: { equals: `${key}.jpg` } },
			file: img.file,
			data: { alt: img.alt, caption: img.alt, credit: img.credit },
		});
		media[key] = doc.id;
	}
	const m = (key: string) => media[key as ImageKey]!;
	const ms = (keys: readonly string[]) => keys.map(m);

	// ----- Legal (locked) and team -----------------------------------------------------------------
	for (const [slug, title, body] of [
		['privacy-policy', 'Privacy policy', LEGAL.privacy],
		['terms', 'Terms', LEGAL.terms],
	] as const) {
		const doc = await ensure('legal', { where: { slug: { equals: slug } }, data: { title, body } });
		if (!doc.body) await cms.update('legal', doc.id, { body });
	}

	const team: Record<string, string> = {};
	for (const t of TEAM) {
		team[t.name] = (await ensure('team', { where: { name: { equals: t.name } }, data: t })).id;
	}

	// ----- Hotel -----------------------------------------------------------------------------------
	const roomIds: string[] = [];
	for (const r of ROOMS) {
		const doc = await ensure('rooms', {
			where: { name: { equals: r.name } },
			data: {
				name: r.name,
				view: r.view,
				featured: r.featured,
				count: r.count,
				sizeSqm: r.sizeSqm,
				maxGuests: r.maxGuests,
				beds: r.beds,
				priceFrom: r.priceFrom,
				summary: r.summary,
				description: r.description,
				cover: m(r.cover),
				gallery: ms(r.gallery),
				amenities: r.amenities.map(([label, icon]) => ({ label, icon })) as never,
				meta: { title: `${r.name} in Changspa, Leh`, description: r.summary },
			} as never,
		});
		roomIds.push(doc.id);
	}

	for (const e of EXPERIENCES) {
		await ensure('experiences', {
			where: { title: { equals: e.title } },
			data: { ...e, cover: m(e.cover), gallery: ms(e.gallery), meta: { description: e.summary } } as never,
		});
	}

	const tags: Record<string, string> = {};
	for (const name of TAGS) tags[name] = (await ensure('tags', { where: { name: { equals: name } }, data: { name } })).id;
	for (const post of POSTS) {
		await ensure('posts', {
			where: { title: { equals: post.title } },
			data: {
				title: post.title,
				publishedAt: `${post.date}T06:00:00.000Z`,
				author: team[post.author],
				tags: post.tags.map((t) => tags[t]!),
				excerpt: post.excerpt,
				cover: m(post.cover),
				body: post.body,
				meta: { description: post.excerpt },
			} as never,
		});
	}

	for (const [quote, name, from, rating, stayedIn] of TESTIMONIALS) {
		await ensure('testimonials', { where: { name: { equals: name } }, data: { quote, name, from, rating, stayedIn } });
	}
	for (const [question, answer, category] of FAQS) {
		await ensure('faqs', { where: { question: { equals: question } }, data: { question, answer, category } });
	}
	for (const [name, description, course, ladakhi, vegetarian] of DISHES) {
		await ensure('dishes', { where: { name: { equals: name } }, data: { name, description, course, ladakhi, vegetarian } });
	}
	for (const o of OFFERS) {
		await ensure('offers', {
			where: { title: { equals: o.title } },
			data: { ...o, cover: m(o.cover), validFrom: `${o.validFrom}T00:00:00.000Z`, validTo: `${o.validTo}T00:00:00.000Z` },
		});
	}
	const albums: Record<string, string> = {};
	for (const a of ALBUMS) {
		albums[a.title] = (await ensure('albums', { where: { title: { equals: a.title } }, data: { title: a.title, images: ms(a.images) } })).id;
	}

	// ----- Pages -----------------------------------------------------------------------------------
	const sec = (blockType: string, data: Record<string, unknown>) => ({ blockType, ...data });
	const faqImage = m('likir-courtyard');

	await ensure('pages', {
		where: { slug: { equals: 'home' } },
		data: {
			title: 'Home',
			slug: 'home',
			cover: m('changspa-valley'),
			meta: {
				title: 'Dolkar House, a mud-brick guesthouse in Leh, Ladakh',
				description: 'Twelve rooms, an apricot orchard and a rooftop with views of Shanti Stupa, in Changspa, Leh at 3,500 metres.',
				image: m('changspa-valley'),
			},
			sections: [
				sec('hero', {
					heading: 'Slow mornings at 3,500 m',
					subheading: 'A family-run mud-brick house with twelve rooms, an apricot orchard and a roof with a view of Shanti Stupa.',
					image: m('changspa-valley'),
					secondImage: m('apricot-tree'),
					ctaLabel: 'Ask about a room',
					ctaHref: '/rooms',
				}),
				sec('split', {
					heading: 'A house built the old way',
					text: rt(
						'Dolkar House is made of sun-dried mud brick, whitewashed walls and poplar beams, with willow-twig ceilings. The walls are thick, which keeps the rooms cool in July and warm at night.',
						'We are in Changspa, a green ten-minute walk from the main bazaar. The courtyard orchard has fourteen apricot trees, and the jam on the breakfast table comes from them.',
					),
					image: m('likir-courtyard'),
					imageSide: 'right',
					ctaLabel: 'Read about the house',
					ctaHref: '/about',
				}),
				sec('stats', {
					heading: 'The house in numbers',
					image: m('stok-kangri'),
					items: [
						{ value: '3,500 m', label: 'above the sea', note: 'Take the first day slowly.' },
						{ value: '12', label: 'rooms in four kinds' },
						{ value: '14', label: 'apricot trees in the courtyard' },
						{ value: '0', label: 'plastic bottles: filtered water is free' },
					],
				}),
				sec('roomsList', {
					heading: 'Four kinds of room',
					intro: 'From a ground-floor room opening into the orchard to a rooftop with windows on three sides.',
					onlyFeatured: true,
				}),
				sec('gallery', { heading: 'The house, the valley and the road', album: albums['The house and the orchard'] }),
				sec('quote', {
					text: 'Tsering told us to do nothing on day one, and he was right. We slept, and woke up ready for the mountains.',
					attribution: 'Daniel and Ruth, Leeds',
					image: m('zanskar-range'),
				}),
				sec('experiencesList', {
					heading: 'Beyond the gate',
					intro: 'Monastery mornings, high passes and a cooking lesson. We arrange the car, the driver and the permits.',
					count: 3,
				}),
				sec('testimonials', { heading: 'Guests write', count: 3 }),
				sec('offers', { heading: 'Offers this season' }),
				sec('faq', { heading: 'Good to know', image: faqImage }),
				sec('location', {
					heading: 'Find us in Changspa',
					text: rt('We are ten minutes from the airport and a quiet fifteen-minute walk from the main bazaar, in the green part of Leh.'),
					image: m('main-bazaar'),
					directions: [
						{ label: 'From the airport', text: 'Ten minutes by car. We send one: ₹600.' },
						{ label: 'From the main bazaar', text: 'Walk up Changspa Road past the prayer-wheel pavilion. We are on the left, behind the green gate.' },
						{ label: 'From Shanti Stupa', text: 'Fifteen minutes downhill on foot, along the stream.' },
					],
				}),
				sec('cta', {
					heading: 'Come for a week. Start with a slow day.',
					text: 'Tell us your dates and who is travelling. We reply within a day.',
					label: 'Enquire',
					href: '/contact',
					image: m('prayer-flags'),
				}),
			],
		} as never,
	});

	await ensure('pages', {
		where: { slug: { equals: 'about' } },
		data: {
			title: 'About the house',
			slug: 'about',
			meta: { description: 'A family house in Changspa, built the old way, with an apricot orchard.' },
			sections: [
				sec('hero', {
					heading: 'A family house',
					subheading: 'Three generations, fourteen apricot trees and one very patient oven.',
					image: m('harvest-village'),
					secondImage: m('apricot-preparing'),
				}),
				sec('richText', {
					heading: 'How we began',
					body: rt(
						'Dolkar’s grandparents built the first rooms around the courtyard in the 1960s, from mud brick dug and dried on the same land. Guests began to stay in the 1990s, when the first foreign trekkers walked up the lane and asked for tea.',
						'Today there are twelve rooms. The walls are still mud brick, the roofs still poplar and willow, and the family still lives in the east wing.',
						h2('What we care about'),
						ul('Building and repairing in local materials', 'Solar hot water and no plastic bottles', 'Going slowly: guests, drivers and apricots'),
					),
				}),
				sec('features', {
					title: 'Small things we do',
					items: [
						{ label: 'Solar hot water', text: 'With a backup for cloudy days.', icon: 'hotwater' },
						{ label: 'Filtered water refills', text: 'Free, so no plastic bottles.', icon: 'water' },
						{ label: 'Butter tea on arrival', text: 'It helps at altitude.', icon: 'tea' },
						{ label: 'Oxygen on request', text: 'We hope you never need it.', icon: 'oxygen' },
					],
				}),
				sec('split', {
					heading: 'The kitchen',
					text: rt('Stanzin has cooked in this kitchen for thirty years. Breakfast is included, dinner is on request, and the cooking morning is the thing guests talk about on the way home.'),
					image: m('ladakhi-kitchen'),
					imageSide: 'left',
					ctaLabel: 'See the menu',
					ctaHref: '/dining',
				}),
				sec('cta', { heading: 'Stay with us', text: 'Open April to October. Winter stays by arrangement.', label: 'Enquire', href: '/contact', image: m('changspa-valley') }),
			],
		} as never,
	});

	await ensure('pages', {
		where: { slug: { equals: 'dining' } },
		data: {
			title: 'Dining',
			slug: 'dining',
			sections: [
				sec('split', {
					heading: 'Ladakhi food, made at home',
					text: rt(p('Breakfast is included: khambir bread with butter and orchard jam, eggs, porridge and tea. Dinner is on request, told to us by noon, cooked fresh by Stanzin.')),
					image: m('thukpa'),
					imageSide: 'right',
				}),
			],
		} as never,
	});
	await ensure('pages', {
		where: { slug: { equals: 'contact' } },
		data: {
			title: 'Contact',
			slug: 'contact',
			sections: [
				sec('location', {
					heading: 'Find us',
					text: rt('Changspa Road, Leh. Ten minutes from the airport.'),
					image: m('leh-street'),
					directions: [{ label: 'By car', text: 'Tell the driver Changspa Road, Dolkar House, behind the green gate.' }],
				}),
			],
		} as never,
	});

	// ----- Site settings ---------------------------------------------------------------------------
	const home = await cms.findOne('pages', { where: { slug: { equals: 'home' } } });
	const about = await cms.findOne('pages', { where: { slug: { equals: 'about' } } });
	const siteData = {
		siteName: 'Dolkar House',
		tagline: 'A family-run guesthouse in Changspa, Leh, Ladakh. Twelve rooms, an apricot orchard, slow mornings at 3,500 metres.',
		nav: [
			{ label: 'Rooms', href: '/rooms' },
			{ label: 'Experiences', href: '/experiences' },
			{ label: 'Dining', href: '/dining' },
			{ label: 'Journal', href: '/journal' },
			{ label: 'About', page: about?.id },
			{ label: 'Contact', href: '/contact' },
		],
		season: 'Open April to October. Winter stays by arrangement.',
		checkIn: '1 pm',
		checkOut: '11 am',
		footerText: 'A mud-brick house with a courtyard orchard, a rooftop and a very slow breakfast.',
		social: [
			{ label: 'Instagram', url: 'https://instagram.com/' },
			{ label: 'Tripadvisor', url: 'https://tripadvisor.com/' },
		],
		contact: {
			address: 'Changspa Road, Changspa\nLeh, Ladakh 194101',
			phone: '+91 98765 43210',
			whatsapp: '+91 98765 43210',
			email: 'stay@dolkarhouse.example',
			mapUrl: 'https://www.openstreetmap.org/?mlat=34.1587&mlon=77.5640#map=16/34.1587/77.5640',
			latitude: 34.1587,
			longitude: 77.564,
		},
		announcement: { enabled: true, text: 'Apricot season is on: the orchard is picked from the middle of July.', link: '/journal' },
		bookingCta: { label: 'Enquire', href: '/contact' },
		design: {
			header: 'a',
			footer: 'a',
			home: 'a',
			page: 'a',
			rooms: 'a',
			room: 'a',
			experiences: 'a',
			experience: 'a',
			journal: 'a',
			post: 'a',
			gallery: 'a',
			dining: 'a',
			contact: 'a',
		},
	};
	// A local database seeded by the old playground seed still has the placeholder site: upgrade it once.
	const current = await cms.findGlobal('site');
	if (current.siteName === 'kitcms dev') await cms.updateGlobal('site', siteData as never);
	else await ensureGlobal('site', siteData as never);
	void home;
	void roomIds;
	log('Dolkar House seeded.');
});
