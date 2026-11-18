// The Dolkar House demo site (a fictional 12-room hotel in Leh, Ladakh). The schema is code-only:
// collections, blocks and the `site` global's Design tab are all defined here. Page types and their
// designs come from the registry in `lib/site/designs.ts`.
import { block, collection, defineConfig, fields as f, global } from '@kitcms/core';
import { seo } from '@kitcms/plugin-seo';
import { designOptions, type PageType } from './lib/site/designs';
import { AMENITY_ICONS } from './lib/site/icons';

const DESIGN_HINT = 'Leave empty to use the site setting (Site settings, Design tab). Pick one to override it for this page only.';
/** Per-page override select for a page type. */
const pageDesign = (type: PageType) =>
	f.select({
		label: 'Design',
		options: designOptions(type),
		admin: { position: 'sidebar', description: DESIGN_HINT },
	});
/** Site-wide default select for a page type (default: the type's first design). */
const siteDesign = (type: PageType) => f.select({ options: designOptions(type), defaultValue: designOptions(type)[0]!.value });

// The home page (slug `home`) uses the `home` designs, every other page the `page` designs.
const pageOptions = designOptions('page').map((o) => ({
	value: o.value,
	label: `${o.label} (home: ${designOptions('home').find((h) => h.value === o.value)?.label.split(' · ')[1] ?? o.value})`,
}));

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Optional brand colour override: empty, `#rgb` or `#rrggbb` (it ends up in a CSS variable). */
const hex = (label: string) =>
	f.text({
		label,
		maxLength: 7,
		validate: (value) => !value || HEX.test(value) || 'Use a hex colour such as #456f3a.',
		admin: { placeholder: '#456f3a', description: 'Empty uses the default.' },
	});

// ----- Blocks -----------------------------------------------------------------------------------
// Every block renders in all designs (the page's resolved design), see lib/site/blocks/.

const Hero = block({
	slug: 'hero',
	fields: {
		heading: f.text({ required: true }),
		subheading: f.textarea(),
		image: f.upload({ relationTo: 'media' }),
		secondImage: f.upload({ relationTo: 'media', admin: { description: 'Used by designs with a second picture.' } }),
		ctaLabel: f.text({ label: 'Button label' }),
		ctaHref: f.text({ label: 'Button link' }),
	},
});

const Features = block({
	slug: 'features',
	fields: {
		title: f.text(),
		items: f.array({
			fields: {
				label: f.text({ required: true }),
				text: f.text(),
				icon: f.select({ options: AMENITY_ICONS }),
			},
			maxRows: 8,
		}),
	},
});

const RichTextBlock = block({
	slug: 'richText',
	fields: { heading: f.text(), body: f.richText() },
});

const Split = block({
	slug: 'split',
	labels: { singular: 'Picture and text' },
	fields: {
		heading: f.text(),
		text: f.richText(),
		image: f.upload({ relationTo: 'media' }),
		imageSide: f.select({ options: ['left', 'right'], defaultValue: 'left' }),
		ctaLabel: f.text({ label: 'Button label' }),
		ctaHref: f.text({ label: 'Button link' }),
	},
});

const GalleryBlock = block({
	slug: 'gallery',
	fields: {
		heading: f.text(),
		album: f.relationship({ relationTo: 'albums', admin: { description: 'Show an album, or pick pictures below.' } }),
		images: f.upload({ relationTo: 'media', hasMany: true }),
	},
});

const Cta = block({
	slug: 'cta',
	labels: { singular: 'Call to action' },
	fields: {
		heading: f.text({ required: true }),
		text: f.textarea(),
		label: f.text({ label: 'Button label' }),
		href: f.text({ label: 'Button link' }),
		image: f.upload({ relationTo: 'media' }),
	},
});

const Stats = block({
	slug: 'stats',
	labels: { singular: 'Key facts' },
	fields: {
		heading: f.text(),
		image: f.upload({ relationTo: 'media' }),
		items: f.array({
			fields: { value: f.text({ required: true }), label: f.text({ required: true }), note: f.text() },
			maxRows: 6,
		}),
	},
});

const RoomsList = block({
	slug: 'roomsList',
	labels: { singular: 'Rooms' },
	fields: {
		heading: f.text(),
		intro: f.textarea(),
		onlyFeatured: f.checkbox({ label: 'Only featured rooms' }),
	},
});

const ExperiencesList = block({
	slug: 'experiencesList',
	labels: { singular: 'Experiences' },
	fields: { heading: f.text(), intro: f.textarea(), count: f.number({ integer: true, min: 1, max: 12, defaultValue: 3 }) },
});

const TestimonialsBlock = block({
	slug: 'testimonials',
	fields: { heading: f.text(), count: f.number({ integer: true, min: 1, max: 12, defaultValue: 3 }) },
});

const FaqBlock = block({
	slug: 'faq',
	labels: { singular: 'Questions' },
	fields: {
		heading: f.text(),
		category: f.select({ options: ['Arriving', 'Altitude', 'Rooms', 'Dining', 'Travel'], admin: { description: 'Empty shows all.' } }),
		image: f.upload({ relationTo: 'media' }),
	},
});

const Quote = block({
	slug: 'quote',
	fields: {
		text: f.textarea({ required: true }),
		attribution: f.text(),
		image: f.upload({ relationTo: 'media' }),
	},
});

const Location = block({
	slug: 'location',
	fields: {
		heading: f.text(),
		text: f.richText(),
		image: f.upload({ relationTo: 'media' }),
		directions: f.array({ fields: { label: f.text({ required: true }), text: f.text() }, maxRows: 8 }),
	},
});

const Offers = block({
	slug: 'offers',
	fields: { heading: f.text() },
});

const BLOCKS = [
	Hero,
	Features,
	RichTextBlock,
	Split,
	GalleryBlock,
	Cta,
	Stats,
	RoomsList,
	ExperiencesList,
	TestimonialsBlock,
	FaqBlock,
	Quote,
	Location,
	Offers,
] as const;

const publicRead = { read: () => true };

export default defineConfig({
	admin: { title: 'Dolkar House' },
	plugins: [seo({ collections: ['pages', 'rooms', 'experiences', 'posts'], uploadsCollection: 'media' })],
	collections: [
		// ----- Content ---------------------------------------------------------------------------
		collection({
			slug: 'pages',
			// Drafts + autosave (§13.4): public reads only ever see published pages.
			versions: { drafts: { autosave: true }, max: 20 },
			admin: { group: 'Content', useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				// Home (slug `home`) uses the `home` designs, every other page the `page` designs.
				design: f.select({
					label: 'Design',
					options: pageOptions,
					admin: { position: 'sidebar', description: DESIGN_HINT },
				}),
				publishedAt: f.date({ admin: { position: 'sidebar' } }),
				featured: f.checkbox({ admin: { position: 'sidebar' } }),
				content: f.tabs({
					tabs: [
						{
							label: 'Content',
							fields: {
								cover: f.upload({ relationTo: 'media' }),
								sections: f.blocks({ blocks: BLOCKS }),
							},
						},
					],
				}),
			},
		}),
		collection({
			slug: 'rooms',
			orderable: true,
			versions: { drafts: true, max: 10 },
			labels: { singular: 'Room type', plural: 'Rooms' },
			admin: { group: 'Hotel', useAsTitle: 'name', defaultColumns: ['name', 'view', 'count', 'priceFrom', 'featured'] },
			access: publicRead,
			fields: {
				name: f.text({ required: true }),
				slug: f.slug({ from: 'name', unique: true, admin: { position: 'sidebar' } }),
				pageDesign: pageDesign('room'),
				view: f.select({
					options: [
						{ label: 'Orchard', value: 'orchard' },
						{ label: 'Mountains', value: 'mountain' },
						{ label: 'Shanti Stupa', value: 'stupa' },
						{ label: 'Courtyard', value: 'courtyard' },
					],
					admin: { position: 'sidebar' },
				}),
				featured: f.checkbox({ admin: { position: 'sidebar' } }),
				summary: f.textarea({ maxLength: 220 }),
				description: f.richText(),
				cover: f.upload({ relationTo: 'media' }),
				gallery: f.upload({ relationTo: 'media', hasMany: true }),
				facts: f.row({
					fields: {
						sizeSqm: f.number({ label: 'Size (m²)', integer: true, min: 5 }),
						maxGuests: f.number({ integer: true, min: 1 }),
						beds: f.text({ admin: { placeholder: '1 king or 2 single' } }),
						count: f.number({ label: 'Rooms of this type', integer: true, min: 1 }),
						priceFrom: f.number({ label: 'From, INR per night', integer: true, min: 0 }),
					},
				}),
				amenities: f.array({
					fields: { label: f.text({ required: true }), icon: f.select({ options: AMENITY_ICONS }) },
					maxRows: 14,
				}),
			},
		}),
		collection({
			slug: 'experiences',
			orderable: true,
			versions: { drafts: true, max: 10 },
			admin: { group: 'Hotel', useAsTitle: 'title', defaultColumns: ['title', 'duration', 'difficulty'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				pageDesign: pageDesign('experience'),
				difficulty: f.select({ options: ['easy', 'moderate', 'hard'], admin: { position: 'sidebar' } }),
				duration: f.text({ admin: { position: 'sidebar', placeholder: 'Full day' } }),
				season: f.text({ admin: { position: 'sidebar', placeholder: 'May to October' } }),
				priceNote: f.text({ admin: { position: 'sidebar', placeholder: 'Car and driver from ₹6,500' } }),
				summary: f.textarea({ maxLength: 220 }),
				body: f.richText(),
				cover: f.upload({ relationTo: 'media' }),
				gallery: f.upload({ relationTo: 'media', hasMany: true }),
			},
		}),
		collection({
			slug: 'posts',
			labels: { singular: 'Journal post', plural: 'Journal' },
			versions: { drafts: true, max: 10 },
			admin: { group: 'Content', useAsTitle: 'title', defaultColumns: ['title', 'publishedAt', '_status'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				pageDesign: pageDesign('post'),
				publishedAt: f.date({ admin: { position: 'sidebar' } }),
				author: f.relationship({ relationTo: 'team', admin: { position: 'sidebar' } }),
				tags: f.relationship({ relationTo: 'tags', hasMany: true, admin: { position: 'sidebar' } }),
				excerpt: f.textarea({ maxLength: 260 }),
				cover: f.upload({ relationTo: 'media' }),
				body: f.richText(),
			},
		}),
		collection({
			slug: 'tags',
			admin: { group: 'Content', useAsTitle: 'name' },
			access: publicRead,
			fields: { name: f.text({ required: true }), slug: f.slug({ from: 'name', unique: true }) },
		}),
		collection({
			slug: 'albums',
			orderable: true,
			labels: { singular: 'Album', plural: 'Albums' },
			admin: { group: 'Content', useAsTitle: 'title' },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				description: f.textarea(),
				images: f.upload({ relationTo: 'media', hasMany: true }),
			},
		}),
		// ----- Hotel -----------------------------------------------------------------------------
		collection({
			slug: 'testimonials',
			orderable: true,
			admin: { group: 'Hotel', useAsTitle: 'name', defaultColumns: ['name', 'from', 'rating'] },
			access: publicRead,
			fields: {
				quote: f.textarea({ required: true }),
				name: f.text({ required: true }),
				from: f.text({ admin: { placeholder: 'Mumbai, India' } }),
				rating: f.number({ integer: true, min: 1, max: 5, defaultValue: 5 }),
				stayedIn: f.text({ admin: { placeholder: 'Orchard room, September' } }),
			},
		}),
		collection({
			slug: 'faqs',
			orderable: true,
			labels: { singular: 'Question', plural: 'FAQs' },
			admin: { group: 'Hotel', useAsTitle: 'question', defaultColumns: ['question', 'category'] },
			access: publicRead,
			fields: {
				question: f.text({ required: true }),
				answer: f.textarea({ required: true }),
				category: f.select({ options: ['Arriving', 'Altitude', 'Rooms', 'Dining', 'Travel'], admin: { position: 'sidebar' } }),
			},
		}),
		collection({
			slug: 'offers',
			admin: { group: 'Hotel', useAsTitle: 'title', defaultColumns: ['title', 'validFrom', 'validTo'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				summary: f.textarea(),
				cover: f.upload({ relationTo: 'media' }),
				validFrom: f.date({ admin: { position: 'sidebar' } }),
				validTo: f.date({ admin: { position: 'sidebar' } }),
				ctaLabel: f.text({ label: 'Button label' }),
				ctaHref: f.text({ label: 'Button link' }),
				terms: f.textarea(),
			},
		}),
		collection({
			slug: 'dishes',
			orderable: true,
			labels: { singular: 'Dish', plural: 'Dishes' },
			admin: { group: 'Hotel', useAsTitle: 'name', defaultColumns: ['name', 'course', 'ladakhi', 'vegetarian'] },
			access: publicRead,
			fields: {
				name: f.text({ required: true }),
				description: f.textarea(),
				course: f.select({ options: ['breakfast', 'lunch', 'dinner', 'drinks'], required: true, admin: { position: 'sidebar' } }),
				ladakhi: f.checkbox({ label: 'Ladakhi dish', admin: { position: 'sidebar' } }),
				vegetarian: f.checkbox({ admin: { position: 'sidebar' } }),
			},
		}),
		// Orderable (§13.2): drag to reorder in the admin list; `find` returns them in that order.
		collection({
			slug: 'team',
			orderable: true,
			admin: { group: 'Hotel', useAsTitle: 'name', defaultColumns: ['name', 'role'] },
			access: publicRead,
			fields: {
				name: f.text({ required: true }),
				role: f.text(),
				photo: f.upload({ relationTo: 'media' }),
				bio: f.textarea(),
			},
		}),
		// Locked (§13.3): created by `pnpm db:seed`; editors can edit but not create or delete.
		collection({
			slug: 'legal',
			admin: { locked: true, group: 'Content', useAsTitle: 'title', defaultColumns: ['title', 'slug', 'updatedAt'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				body: f.richText(),
			},
		}),
		collection({
			slug: 'media',
			admin: { group: 'Content' },
			upload: { mimeTypes: ['image/*', 'application/pdf'] },
			access: publicRead,
			fields: {
				alt: f.text(),
				caption: f.text(),
				credit: f.text({ admin: { description: 'Photographer, licence and source for openly licensed pictures.' } }),
			},
		}),
	],
	globals: [
		global({
			slug: 'site',
			label: 'Site settings',
			admin: { group: 'Site' },
			versions: { drafts: true },
			access: publicRead,
			fields: {
				tabs: f.tabs({
					tabs: [
						{
							label: 'General',
							fields: {
								siteName: f.text({ required: true }),
								tagline: f.textarea(),
								logo: f.upload({ relationTo: 'media' }),
								nav: f.array({
									fields: {
										label: f.text({ required: true }),
										page: f.relationship({ relationTo: 'pages' }),
										href: f.text({ admin: { description: 'A path such as /rooms. Used when no page is picked.' } }),
									},
									maxRows: 8,
								}),
								season: f.text({ admin: { placeholder: 'Open April to October. Winter stays by arrangement.' } }),
								checkIn: f.text({ admin: { placeholder: '1 pm' } }),
								checkOut: f.text({ admin: { placeholder: '11 am' } }),
								footerText: f.textarea(),
								social: f.array({ fields: { label: f.text({ required: true }), url: f.text({ required: true }) }, maxRows: 6 }),
							},
						},
						{
							label: 'Contact and booking',
							fields: {
								contact: f.group({
									fields: {
										address: f.textarea(),
										phone: f.text(),
										whatsapp: f.text(),
										email: f.email(),
										mapUrl: f.text({ label: 'Map link' }),
										latitude: f.number(),
										longitude: f.number(),
									},
								}),
								announcement: f.group({
									fields: { enabled: f.checkbox(), text: f.text(), link: f.text() },
								}),
								bookingCta: f.group({
									label: 'Booking button',
									fields: { label: f.text({ admin: { placeholder: 'Enquire' } }), href: f.text({ admin: { placeholder: '/contact' } }) },
								}),
							},
						},
						{
							label: 'Design',
							description: 'One design per page type. Pages, rooms and posts can override it. All designs share the same colours and type.',
							fields: {
								design: f.group({
									fields: {
										header: siteDesign('header'),
										footer: siteDesign('footer'),
										home: siteDesign('home'),
										page: siteDesign('page'),
										rooms: siteDesign('rooms'),
										room: siteDesign('room'),
										experiences: siteDesign('experiences'),
										experience: siteDesign('experience'),
										journal: siteDesign('journal'),
										post: siteDesign('post'),
										gallery: siteDesign('gallery'),
										dining: siteDesign('dining'),
										contact: siteDesign('contact'),
									},
								}),
								theme: f.group({
									label: 'Colour overrides',
									fields: {
										accent: hex('Accent (buttons, links)'),
										ground: hex('Ground (page background)'),
										ink: hex('Ink (text)'),
									},
								}),
							},
						},
					],
				}),
			},
		}),
	],
});
