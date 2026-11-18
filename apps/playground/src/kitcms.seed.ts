// Idempotent seed: `pnpm db:seed` (local). Existing documents are never overwritten, so it is safe to
// run again after editors changed things. It builds the whole Halden Studio demo: photographs
// (seed/images, credits in seed/CREDITS.md), services, work, people, journal, offers, legal pages,
// the pages and the site settings, plus a few documents for the Lab collections.
import { defineSeed } from '@kitcms/core';
import images from '../seed/images.json';
import {
	KITCHEN_SINK,
	LEGAL,
	NOTES,
	OFFERS,
	POSTS,
	PROJECTS,
	SERVICES,
	TAGS,
	TEAM,
	TESTIMONIALS,
} from '../seed/data';
import { h2, rt, ul } from '../seed/rt';

type ImageKey = keyof typeof images;

export default defineSeed(async ({ ensure, ensureGlobal, ensureUpload, cms, log }) => {
	// ----- Pictures ----------------------------------------------------------------------------------
	const media = {} as Record<ImageKey, string>;
	for (const [key, img] of Object.entries(images) as [ImageKey, (typeof images)[ImageKey]][]) {
		const doc = await ensureUpload('media', {
			where: { filename: { equals: `${key}.jpg` } },
			file: img.file,
			data: { alt: img.alt, caption: img.alt, credit: img.credit },
		});
		media[key] = doc.id;
	}
	const m = (key: string) => {
		const id = media[key as ImageKey];
		if (!id) throw new Error(`seed: unknown image "${key}"`);
		return id;
	};

	// ----- Legal (locked) ------------------------------------------------------------------------------
	for (const [slug, title, body] of [
		['privacy-policy', 'Privacy policy', LEGAL.privacy],
		['terms', 'Terms', LEGAL.terms],
	] as const) {
		await ensure('legal', { where: { slug: { equals: slug } }, data: { title, body } });
	}

	// ----- People, tags, testimonials -----------------------------------------------------------------
	const team: Record<string, string> = {};
	for (const t of TEAM)
		team[t.name] = (await ensure('team', { where: { name: { equals: t.name } }, data: t })).id;

	const tags: Record<string, string> = {};
	for (const name of TAGS)
		tags[name] = (await ensure('tags', { where: { name: { equals: name } }, data: { name } })).id;

	const testimonials: Record<string, string> = {};
	for (const { key, ...t } of TESTIMONIALS) {
		testimonials[key] = (
			await ensure('testimonials', { where: { name: { equals: t.name } }, data: t })
		).id;
	}

	// ----- Services and work -----------------------------------------------------------------------
	const services: Record<string, string> = {};
	for (const s of SERVICES) {
		const doc = await ensure('services', {
			where: { slug: { equals: s.slug } },
			data: {
				title: s.title,
				slug: s.slug,
				icon: s.icon,
				priceFrom: s.priceFrom,
				summary: s.summary,
				cover: m(s.cover),
				body: s.body,
				deliverables: s.deliverables.map((label) => ({ label })),
				process: s.process,
				meta: { title: `${s.title} in Bengaluru`, description: s.summary },
			} as never,
		});
		services[s.slug] = doc.id;
	}

	for (const proj of PROJECTS) {
		await ensure('projects', {
			where: { title: { equals: proj.title } },
			data: {
				title: proj.title,
				client: proj.client,
				year: proj.year,
				featured: proj.featured,
				services: proj.services.map((s) => services[s]!),
				summary: proj.summary,
				cover: m(proj.cover),
				gallery: proj.gallery.map(m),
				facts: proj.facts,
				body: proj.body,
				...(proj.testimonial ? { testimonial: testimonials[proj.testimonial] } : {}),
				meta: { description: proj.summary },
			} as never,
		});
	}

	// ----- Journal ------------------------------------------------------------------------------------
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

	// ----- Offers (behind the `offers` add-on: a denied create is fine) ---------------------------------
	try {
		for (const o of OFFERS) {
			await ensure('offers', {
				where: { title: { equals: o.title } },
				data: {
					...o,
					includes: o.includes.map((label) => ({ label })),
					validTo: `${o.validTo}T00:00:00.000Z`,
				} as never,
			});
		}
	} catch (err) {
		log(`Offers skipped: ${err instanceof Error ? err.message : String(err)}`);
	}

	// ----- Lab ------------------------------------------------------------------------------------------
	for (const k of KITCHEN_SINK) {
		await ensure('kitchen-sink', { where: { title: { equals: k.title } }, data: k as never });
	}
	for (const n of NOTES) {
		await ensure('notes', { where: { title: { equals: n.title } }, data: n as never });
	}

	// ----- Pages ----------------------------------------------------------------------------------------
	const sec = (blockType: string, data: Record<string, unknown>) => ({ blockType, ...data });

	await ensure('pages', {
		where: { slug: { equals: 'home' } },
		data: {
			title: 'Home',
			slug: 'home',
			cover: m('type-tray'),
			meta: {
				title: 'Halden Studio, a design studio in Bengaluru',
				description:
					'Brand identity, websites, product design and photography for small businesses, from a studio in Shivajinagar, Bengaluru.',
				image: m('type-tray'),
			},
			sections: [
				sec('hero', {
					heading: 'Design for businesses that make things',
					subheading:
						'We are a studio of four in Bengaluru. We make brand identities, websites, products and photographs for small companies that care how their work looks.',
					image: m('type-tray'),
					ctaLabel: 'See our work',
					ctaHref: '/work',
				}),
				sec('servicesList', {
					heading: 'What we make',
					intro: 'Four kinds of work, each done by the people whose names are on the team page.',
				}),
				sec('projectsList', { heading: 'Selected work', count: 4, onlyFeatured: true }),
				sec('stats', {
					heading: 'The studio in numbers',
					items: [
						{ value: '2017', label: 'the year we started' },
						{ value: '4', label: 'people in the studio' },
						{ value: '60+', label: 'projects delivered' },
						{ value: '10 wk', label: 'a typical identity project' },
					],
				}),
				sec('testimonials', { heading: 'What clients say', count: 3 }),
				sec('latestPosts', { heading: 'From the journal', count: 3 }),
				sec('cta', {
					heading: 'Have a project in mind?',
					text: 'Tell us what you are making and when you need it. We reply within one working day.',
					label: 'Start a project',
					href: '/contact',
					image: m('drafting-desk'),
				}),
			],
		} as never,
	});

	const aboutSections = [
		sec('hero', {
			heading: 'A small studio, on purpose',
			subheading:
				'Four people, one room above a bookshop, and a rule that the person who pitches the work does the work.',
			image: m('studio-desk'),
		}),
		sec('richText', {
			heading: 'How the studio works',
			body: rt(
				'Halden Studio began in 2017, when Isha Rao left a publisher’s design team with a laptop, a list of former colleagues and one client. The client was a stationery shop. We still work with them.',
				'We stayed small because the work is better when everyone on the project has seen the whole of it. Today there are four of us. We take on about eight projects a year and finish each one before starting the next large one.',
				h2('What we care about'),
				ul(
					'Plain things that last: a type system, a page that loads, an object that ships flat',
					'Honest estimates, written down, with the reasons',
					'Handing over everything: files, fonts, licences and the knowledge to use them',
				),
			),
		}),
		sec('split', {
			heading: 'Where we work',
			text: rt(
				'The studio is on the third floor of an old building off Church Street, with high windows facing north. Most of what Sunita photographs is shot at the window by the stairs.',
				'We meet clients here or on a call. If you are in town, come and see the drawers of type we keep for fun.',
			),
			image: m('type-drawers'),
			imageSide: 'right',
			ctaLabel: 'Get in touch',
			ctaHref: '/contact',
		}),
		sec('gallery', {
			heading: 'Around the studio',
			images: [
				'studio-desk',
				'type-drawers',
				'drawing-instruments',
				'pencil-leads',
				'compact-camera',
				'desk-lamp',
			].map(m),
		}),
		sec('teamGrid', { heading: 'The people' }),
		sec('quote', {
			text: 'A studio should be small enough that the person who drew it can answer the phone.',
			attribution: 'Isha Rao, founder',
			image: m('type-specimen'),
		}),
		sec('cta', {
			heading: 'Say hello',
			text: 'We are always glad to hear about a new project, even if it is not for us.',
			label: 'Contact the studio',
			href: '/contact',
			image: m('film-camera'),
		}),
	];
	await ensure('pages', {
		where: { slug: { equals: 'about' } },
		data: {
			title: 'About',
			slug: 'about',
			cover: m('studio-desk'),
			meta: {
				description:
					'A four-person design studio in Bengaluru, working with small businesses since 2017.',
			},
			sections: aboutSections,
		} as never,
	});

	await ensure('pages', {
		where: { slug: { equals: 'process' } },
		data: {
			title: 'Process',
			slug: 'process',
			cover: m('pencil-leads'),
			meta: {
				description:
					'How a project runs at Halden Studio, from the first conversation to handover.',
			},
			sections: [
				sec('richText', {
					heading: 'How a project runs',
					body: rt(
						'Every project, whatever the service, goes through the same four stages. The lengths vary but the shape does not.',
						h2('1. Brief'),
						'One call or workshop, then a written brief that you sign before we draw. It names the audience, the scope and the number of review rounds.',
						h2('2. Explore'),
						'We try more than one direction at a rough stage so that you can choose with your eyes and not with a description.',
						h2('3. Make'),
						'The chosen direction is built and refined in short cycles. You see something real every week.',
						h2('4. Hand over'),
						'Final files, a guide and a short session with the people who will use the work after we leave.',
					),
				}),
				sec('features', {
					heading: 'What you can expect from us',
					items: [
						{
							title: 'A written scope',
							text: 'Before any drawing, with the review rounds and the price.',
							icon: 'pen',
						},
						{
							title: 'Weekly progress',
							text: 'Something to look at every week, even if it is rough.',
							icon: 'clock',
						},
						{
							title: 'Plain answers',
							text: 'We tell you what we think, and why, in words.',
							icon: 'chat',
						},
						{
							title: 'Full handover',
							text: 'Files, fonts and the knowledge to use them.',
							icon: 'star',
						},
					],
				}),
				sec('faq', {
					heading: 'Questions we get asked',
					items: [
						{
							question: 'How long does a project take?',
							answer:
								'An identity usually takes ten weeks, a website six to eight, a photography job two. Product design is the longest at three to four months because a prototype has to be made.',
						},
						{
							question: 'How do you charge?',
							answer:
								'A fixed fee for each project, agreed in the scope. The price list on each service page shows where fees start. We invoice in three parts: at the start, at the midpoint and at handover.',
						},
						{
							question: 'Do you work outside Bengaluru?',
							answer:
								'Yes. Most of our clients are in India and a few are abroad. We meet on video, and visit for photography or when a workshop needs it.',
						},
						{
							question: 'Who owns the work?',
							answer:
								'You do, once the final invoice is paid. Licences for fonts and photographs are listed in the handover.',
						},
						{
							question: 'What if we need changes after handover?',
							answer:
								'Small fixes in the first 30 days are included. After that we work by the hour, or you can do it yourself with the guide.',
						},
					],
				}),
				sec('cta', {
					heading: 'Ready to start?',
					text: 'A short message is enough. We will ask the rest.',
					label: 'Start a project',
					href: '/contact',
				}),
			],
		} as never,
	});

	// ----- Site settings ------------------------------------------------------------------------------
	const about = await cms.findOne('pages', { where: { slug: { equals: 'about' } } });
	const siteData = {
		siteName: 'Halden Studio',
		tagline:
			'A design studio in Bengaluru. Brand identity, websites, product design and photography for small businesses.',
		nav: [
			{ label: 'Work', href: '/work' },
			{ label: 'Services', href: '/services' },
			{ label: 'About', page: about?.id },
			{ label: 'Blog', href: '/blog' },
			{ label: 'Contact', href: '/contact' },
		],
		cta: { label: 'Start a project', href: '/contact' },
		announcement: {
			enabled: false,
			text: 'We have two project slots open from January.',
			link: '/contact',
		},
		footerText:
			'A four-person design studio in Bengaluru. This is a demo site: the studio and its clients are fictional.',
		social: [
			{ label: 'Instagram', url: 'https://instagram.com/' },
			{ label: 'Behance', url: 'https://behance.net/' },
		],
		contact: {
			email: 'hello@halden.example',
			phone: '+91 80 5550 0142',
			address: 'Studio 3, Third Floor, 14 Church Lane\nShivajinagar, Bengaluru 560001',
			hours: 'Mon to Fri, 10 am to 6 pm',
			mapUrl: 'https://www.openstreetmap.org/?mlat=12.9847&mlon=77.6044#map=16/12.9847/77.6044',
		},
	};
	await ensureGlobal('site', siteData as never);
	log('Halden Studio seeded.');
});
