// The kitcms playground: "Halden Studio", a small fictional design studio, plus a Lab group that
// exercises every field type and the access rules. The schema is code-only. Page types and their
// designs come from the registry in `lib/site/designs.ts`.
import { block, collection, defineConfig, fields as f, global } from '@kitcms/core';
import { enquiries } from '@kitcms/plugin-enquiries';
import { entitlements } from '@kitcms/plugin-entitlements';
import { seo } from '@kitcms/plugin-seo';
import { designOptions, isHex, type PageType } from './lib/site/designs';
import { BUDGET_OPTIONS, SERVICE_OPTIONS, TIMELINE_OPTIONS } from './lib/site/enquiry';
import { ICONS } from './lib/site/icons';
import { TURNSTILE_SITE_KEY } from './lib/site/turnstile';

// ---------------------------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------------------------

const DESIGN_HINT =
	'Leave empty to use the site setting (Site settings > Design). Pick one to override it for this page only.';
/** Per-document override. Select values can't be empty: unset means "use the site setting". */
const pageDesign = (type: PageType) =>
	f.select({ label: 'Design', options: designOptions(type), admin: { position: 'sidebar', description: DESIGN_HINT } });
/** Site-wide default for a page type (the type's first design until changed). */
const siteDesign = (type: PageType) =>
	f.select({ options: designOptions(type), defaultValue: designOptions(type)[0]!.value });
/** Optional brand colour: empty or `#rgb` / `#rrggbb` (it ends up in a CSS variable, validated again at render). */
const hex = (label: string, placeholder: string) =>
	f.text({
		label,
		maxLength: 7,
		validate: (value) => !value || isHex(value) || 'Use a hex colour such as #2f5d50.',
		admin: { placeholder, description: 'Empty uses the default.' },
	});

// ---------------------------------------------------------------------------------------------
// Blocks. Every block renders in all three designs of the page it is on (lib/site/blocks/).
// ---------------------------------------------------------------------------------------------

const Hero = block({
	slug: 'hero',
	fields: {
		heading: f.text({ required: true }),
		subheading: f.textarea(),
		image: f.upload({ relationTo: 'media' }),
		ctaLabel: f.text({ label: 'Button label' }),
		ctaHref: f.text({ label: 'Button link', admin: { placeholder: '/contact or https://...' } }),
	},
});

const RichText = block({
	slug: 'richText',
	labels: { singular: 'Rich text', plural: 'Rich text' },
	fields: { heading: f.text(), body: f.richText() },
});

const Features = block({
	slug: 'features',
	fields: {
		heading: f.text(),
		items: f.array({
			maxRows: 12,
			labels: { singular: 'Feature', plural: 'Features' },
			fields: { title: f.text({ required: true }), text: f.textarea(), icon: f.select({ options: ICONS }) },
		}),
	},
});

const Split = block({
	slug: 'split',
	labels: { singular: 'Picture and text', plural: 'Picture and text' },
	fields: {
		heading: f.text(),
		text: f.richText(),
		image: f.upload({ relationTo: 'media' }),
		imageSide: f.select({ options: ['left', 'right'], defaultValue: 'left' }),
		ctaLabel: f.text({ label: 'Button label' }),
		ctaHref: f.text({ label: 'Button link' }),
	},
});

const Gallery = block({
	slug: 'gallery',
	fields: { heading: f.text(), images: f.upload({ relationTo: 'media', hasMany: true }) },
});

const Stats = block({
	slug: 'stats',
	labels: { singular: 'Key figures', plural: 'Key figures' },
	fields: {
		heading: f.text(),
		items: f.array({ maxRows: 6, fields: { value: f.text({ required: true }), label: f.text({ required: true }) } }),
	},
});

const Quote = block({
	slug: 'quote',
	fields: { text: f.textarea({ required: true }), attribution: f.text(), image: f.upload({ relationTo: 'media' }) },
});

const Faq = block({
	slug: 'faq',
	labels: { singular: 'Questions', plural: 'Questions' },
	fields: {
		heading: f.text(),
		items: f.array({
			maxRows: 20,
			labels: { singular: 'Question', plural: 'Questions' },
			fields: { question: f.text({ required: true }), answer: f.textarea({ required: true }) },
		}),
	},
});

const Cta = block({
	slug: 'cta',
	labels: { singular: 'Call to action', plural: 'Calls to action' },
	fields: {
		heading: f.text({ required: true }),
		text: f.textarea(),
		label: f.text({ label: 'Button label' }),
		href: f.text({ label: 'Button link' }),
		image: f.upload({ relationTo: 'media' }),
	},
});

// Blocks that list a collection (their content is read at render time).
const ServicesList = block({
	slug: 'servicesList',
	labels: { singular: 'Services', plural: 'Services' },
	fields: { heading: f.text(), intro: f.textarea() },
});

const ProjectsList = block({
	slug: 'projectsList',
	labels: { singular: 'Projects', plural: 'Projects' },
	fields: {
		heading: f.text(),
		count: f.number({ integer: true, min: 1, max: 12, defaultValue: 4 }),
		onlyFeatured: f.checkbox({ label: 'Only featured projects' }),
	},
});

const Testimonials = block({
	slug: 'testimonials',
	fields: { heading: f.text(), count: f.number({ integer: true, min: 1, max: 12, defaultValue: 3 }) },
});

const TeamGrid = block({
	slug: 'teamGrid',
	labels: { singular: 'Team', plural: 'Team' },
	fields: { heading: f.text() },
});

const LatestPosts = block({
	slug: 'latestPosts',
	labels: { singular: 'Latest posts', plural: 'Latest posts' },
	fields: { heading: f.text(), count: f.number({ integer: true, min: 1, max: 12, defaultValue: 3 }) },
});

/** Shows the `offers` collection; renders nothing while the `offers` add-on is off. */
const Offers = block({
	slug: 'offers',
	fields: { heading: f.text() },
});

export const BLOCKS = [
	Hero,
	RichText,
	Features,
	Split,
	Gallery,
	Stats,
	Quote,
	Faq,
	Cta,
	ServicesList,
	ProjectsList,
	Testimonials,
	TeamGrid,
	LatestPosts,
	Offers,
] as const;

const publicRead = { read: () => true };

/** The SEO plugin adds its `meta` group to these collections and lists them in the sitemap. */
const seoCollections = ['pages', 'services', 'projects', 'posts'];

// ---------------------------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------------------------

export default defineConfig({
	admin: { title: 'Halden Studio' },
	// Core email: in `vite dev` messages are logged to the console; in workerd they go through the
	// `EMAIL` send_email binding (wrangler.jsonc).
	email: { from: { address: 'hello@halden.example', name: 'Halden Studio' } },
	plugins: [
		seo({
			collections: seoCollections,
			uploadsCollection: 'media',
			redirects: true,
			sitemap: {
				collections: {
					pages: (doc) => (doc.slug === 'home' ? '/' : `/${String(doc.slug)}`),
					services: '/services/:slug',
					projects: '/work/:slug',
					posts: '/blog/:slug',
				},
				paths: ['/services', '/work', '/blog', '/contact'],
			},
			robots: true,
		}),
		enquiries({
			// Test keys (lib/site/turnstile.ts); the secret is `TURNSTILE_SECRET` (see `.dev.vars.example`).
			...(TURNSTILE_SITE_KEY ? { turnstile: { siteKey: TURNSTILE_SITE_KEY } } : {}),
			forms: {
				brief: {
					label: 'Project brief',
					notify: ['studio@halden.example'],
					subject: 'Project brief from {field:name}',
					replyTo: 'email',
					fields: {
						name: { type: 'text', required: true, maxLength: 80 },
						email: { type: 'email', required: true },
						company: { type: 'text', maxLength: 120 },
						service: { type: 'select', options: SERVICE_OPTIONS },
						budget: { type: 'select', options: BUDGET_OPTIONS },
						timeline: { type: 'select', options: TIMELINE_OPTIONS },
						message: { type: 'textarea', required: true },
						consent: { type: 'checkbox', required: true },
					},
				},
				contact: {
					label: 'Contact message',
					notify: ['hello@halden.example'],
					subject: 'Message from {field:name}',
					replyTo: 'email',
					fields: {
						name: { type: 'text', required: true, maxLength: 80 },
						email: { type: 'email', required: true },
						message: { type: 'textarea', required: true },
					},
				},
			},
		}),
		entitlements({
			addons: { offers: { label: 'Offers and packages' }, shop: { label: 'Online shop (coming soon)' } },
			manageUrl: 'https://platform.example/halden/plan',
		}),
	],
	collections: [
		// ----- Content -----------------------------------------------------------------------------
		collection({
			slug: 'pages',
			// Drafts + autosave: public reads only ever see published pages.
			versions: { drafts: { autosave: true }, max: 20 },
			admin: { group: 'Content', useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				// `home` is served at `/`. `services`, `work`, `blog`, `contact`, `legal` and `lab` are routes.
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				// The home page (slug `home`) uses the `home` designs, every other page the `page` designs.
				design: pageDesign('page'),
				content: f.tabs({
					tabs: [
						{
							label: 'Content',
							fields: { cover: f.upload({ relationTo: 'media' }), sections: f.blocks({ blocks: BLOCKS }) },
						},
					],
				}),
			},
		}),
		collection({
			slug: 'posts',
			versions: { drafts: true, max: 10 },
			defaultSort: '-publishedAt',
			admin: { group: 'Content', useAsTitle: 'title', defaultColumns: ['title', 'publishedAt', '_status'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				design: pageDesign('post'),
				publishedAt: f.date({ admin: { position: 'sidebar' } }),
				author: f.relationship({ relationTo: 'team', admin: { position: 'sidebar' } }),
				tags: f.relationship({ relationTo: 'tags', hasMany: true, admin: { position: 'sidebar' } }),
				excerpt: f.textarea({ maxLength: 300 }),
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
		// Locked: created by `pnpm db:seed`; editors can edit but not create or delete.
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
				alt: f.text({ label: 'Alt text' }),
				caption: f.text(),
				credit: f.text({ admin: { description: 'Photographer, licence and source for openly licensed pictures.' } }),
			},
		}),

		// ----- Studio ------------------------------------------------------------------------------
		collection({
			slug: 'services',
			orderable: true,
			versions: { drafts: true, max: 10 },
			admin: { group: 'Studio', useAsTitle: 'title', defaultColumns: ['title', 'priceFrom'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				// Keep in step with SERVICE_OPTIONS (lib/site/enquiry.ts) for the brief form.
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				icon: f.select({ options: ICONS, admin: { position: 'sidebar' } }),
				priceFrom: f.text({ label: 'Price from', admin: { position: 'sidebar', placeholder: 'From ₹1.5 lakh' } }),
				summary: f.textarea({ maxLength: 220 }),
				cover: f.upload({ relationTo: 'media' }),
				body: f.richText(),
				deliverables: f.array({
					maxRows: 12,
					labels: { singular: 'Deliverable', plural: 'Deliverables' },
					fields: { label: f.text({ required: true }) },
				}),
				process: f.array({
					maxRows: 8,
					labels: { singular: 'Step', plural: 'Process' },
					fields: { title: f.text({ required: true }), text: f.textarea() },
				}),
			},
		}),
		collection({
			slug: 'projects',
			orderable: true,
			versions: { drafts: true, max: 10 },
			labels: { singular: 'Project', plural: 'Work' },
			admin: { group: 'Studio', useAsTitle: 'title', defaultColumns: ['title', 'client', 'year', 'featured', '_status'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				design: pageDesign('project'),
				featured: f.checkbox({ admin: { position: 'sidebar' } }),
				year: f.number({ integer: true, min: 1990, max: 2100, admin: { position: 'sidebar' } }),
				services: f.relationship({ relationTo: 'services', hasMany: true, admin: { position: 'sidebar' } }),
				client: f.text(),
				summary: f.textarea({ maxLength: 260 }),
				cover: f.upload({ relationTo: 'media' }),
				facts: f.array({
					maxRows: 8,
					labels: { singular: 'Fact', plural: 'Facts' },
					fields: { label: f.text({ required: true }), value: f.text({ required: true }) },
				}),
				body: f.richText(),
				gallery: f.upload({ relationTo: 'media', hasMany: true }),
				testimonial: f.relationship({ relationTo: 'testimonials' }),
			},
		}),
		collection({
			slug: 'testimonials',
			orderable: true,
			admin: { group: 'Studio', useAsTitle: 'name', defaultColumns: ['name', 'company'] },
			access: publicRead,
			fields: {
				quote: f.textarea({ required: true }),
				name: f.text({ required: true }),
				role: f.text(),
				company: f.text(),
				photo: f.upload({ relationTo: 'media' }),
			},
		}),
		// Orderable: drag to reorder in the admin list; `find` returns them in that order.
		collection({
			slug: 'team',
			orderable: true,
			admin: { group: 'Studio', useAsTitle: 'name', defaultColumns: ['name', 'role'] },
			access: publicRead,
			fields: { name: f.text({ required: true }), role: f.text(), photo: f.upload({ relationTo: 'media' }), bio: f.textarea() },
		}),
		collection({
			slug: 'offers',
			// Runtime add-on gate (plugin-entitlements): off = denied, hidden in the admin, and the site hides offers.
			entitlement: 'offers',
			orderable: true,
			labels: { singular: 'Offer', plural: 'Offers' },
			admin: { group: 'Studio', useAsTitle: 'title', defaultColumns: ['title', 'price', 'validTo'] },
			access: publicRead,
			fields: {
				title: f.text({ required: true }),
				price: f.text({ admin: { placeholder: '₹95,000' } }),
				summary: f.textarea(),
				includes: f.array({ maxRows: 10, fields: { label: f.text({ required: true }) } }),
				validTo: f.date({ admin: { position: 'sidebar' } }),
				ctaLabel: f.text({ label: 'Button label' }),
				ctaHref: f.text({ label: 'Button link' }),
			},
		}),

		// ----- Lab: every field type, and access rules (shown at /lab) ---------------------------
		collection({
			slug: 'kitchen-sink',
			labels: { singular: 'Field sample', plural: 'Every field' },
			versions: { drafts: true, max: 10 },
			admin: {
				group: 'Lab',
				useAsTitle: 'title',
				defaultColumns: ['title', 'count', 'status', 'updatedAt'],
				description: 'One of every field type, with validation, conditions and field access. Rendered at /lab/fields.',
			},
			access: publicRead,
			fields: {
				title: f.text({ required: true, minLength: 2, maxLength: 80 }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				status: f.select({
					options: ['idea', 'doing', 'done'],
					defaultValue: 'idea',
					admin: { position: 'sidebar' },
				}),
				featured: f.checkbox({ admin: { position: 'sidebar' } }),
				due: f.date({ admin: { position: 'sidebar' } }),
				tabs: f.tabs({
					tabs: [
						{
							label: 'Simple',
							description: 'Scalar fields stored in their own columns.',
							fields: {
								summary: f.textarea({ maxLength: 300 }),
								email: f.email(),
								count: f.number({ integer: true, min: 0, max: 100 }),
								ratio: f.number({ min: 0, max: 1, admin: { description: 'A decimal between 0 and 1.' } }),
								website: f.text({
									validate: (value) => !value || /^https:\/\//.test(value) || 'Use an https:// link.',
									admin: { placeholder: 'https://example.com' },
								}),
								// Shown only when `status` is `done` (admin condition).
								doneNote: f.text({ admin: { condition: (data) => data.status === 'done', description: 'Only shown when the status is done.' } }),
								// Field access: anonymous reads drop it, so it never reaches the public site.
								internalNote: f.textarea({
									access: { read: ({ req }) => Boolean(req.user) },
									admin: { description: 'Field access: only signed-in users can read this.' },
								}),
							},
						},
						{
							label: 'Rich',
							description: 'Nested data stored as JSON.',
							fields: {
								body: f.richText(),
								settings: f.json({ admin: { description: 'Any JSON.' } }),
								address: f.group({
									fields: {
										line: f.text(),
										row: f.row({ fields: { city: f.text(), postcode: f.text({ maxLength: 12 }) } }),
									},
								}),
								links: f.array({
									maxRows: 6,
									labels: { singular: 'Link', plural: 'Links' },
									fields: { label: f.text({ required: true }), href: f.text({ required: true }) },
								}),
								advanced: f.collapsible({
									label: 'Advanced',
									admin: { initCollapsed: true },
									fields: { notes: f.textarea(), score: f.number({ min: 0, max: 10 }) },
								}),
								sections: f.blocks({ blocks: [Hero, RichText, Quote, Cta] }),
							},
						},
						{
							label: 'Relations',
							fields: {
								image: f.upload({ relationTo: 'media' }),
								images: f.upload({ relationTo: 'media', hasMany: true }),
								post: f.relationship({ relationTo: 'posts' }),
								tags: f.relationship({ relationTo: 'tags', hasMany: true }),
							},
						},
					],
				}),
			},
		}),
		collection({
			slug: 'notes',
			labels: { singular: 'Note', plural: 'Notes' },
			admin: {
				group: 'Lab',
				useAsTitle: 'title',
				defaultColumns: ['title', 'visibility', 'updatedAt'],
				description: 'Row-level access: visitors read only public notes; signed-in users read all. Shown at /lab/access.',
			},
			access: {
				// A `where` result filters rows instead of allowing or denying the whole collection.
				read: ({ req }) => (req.user ? true : { visibility: { equals: 'public' } }),
			},
			fields: {
				title: f.text({ required: true }),
				visibility: f.select({ options: ['public', 'team'], defaultValue: 'team', required: true, admin: { position: 'sidebar' } }),
				body: f.textarea(),
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
								// Each item links to a page or, for routes that are not pages (`/work`), to a path.
								nav: f.array({
									maxRows: 8,
									labels: { singular: 'Link', plural: 'Navigation' },
									fields: {
										label: f.text({ required: true }),
										page: f.relationship({ relationTo: 'pages' }),
										href: f.text({ admin: { description: 'A path such as /work. Used when no page is picked.' } }),
									},
								}),
								cta: f.group({
									label: 'Header button',
									fields: {
										label: f.text({ admin: { placeholder: 'Start a project' } }),
										href: f.text({ admin: { placeholder: '/contact' } }),
									},
								}),
								announcement: f.group({ fields: { enabled: f.checkbox(), text: f.text(), link: f.text() } }),
								footerText: f.textarea(),
								social: f.array({ maxRows: 6, fields: { label: f.text({ required: true }), url: f.text({ required: true }) } }),
							},
						},
						{
							label: 'Contact',
							fields: {
								contact: f.group({
									fields: {
										email: f.email(),
										phone: f.text(),
										address: f.textarea(),
										hours: f.text({ admin: { placeholder: 'Mon–Fri, 10 am to 6 pm' } }),
										mapUrl: f.text({ label: 'Map link' }),
									},
								}),
							},
						},
						{
							label: 'Design',
							description:
								'One design per page type. Pages, projects and posts can override it in their sidebar. All designs share the same colours and type.',
							fields: {
								design: f.group({
									fields: {
										header: siteDesign('header'),
										footer: siteDesign('footer'),
										home: siteDesign('home'),
										page: siteDesign('page'),
										services: siteDesign('services'),
										work: siteDesign('work'),
										project: siteDesign('project'),
										blog: siteDesign('blog'),
										post: siteDesign('post'),
										contact: siteDesign('contact'),
									},
								}),
								// Set all three together: surface, muted text and lines are derived from them.
								theme: f.group({
									label: 'Colours',
									fields: {
										accent: hex('Accent (buttons, links)', '#2f5d50'),
										background: hex('Background', '#f6f5f1'),
										text: hex('Text', '#161716'),
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
