import { block, collection, defineConfig, fields as f, global } from '@kitcms/core';
import { ICONS } from '#lib/icons.ts';

// ---------------------------------------------------------------------------------------------
// Blocks. Each one has a Svelte component of the same name in `src/lib/blocks/`, used by the
// public site (`RenderBlocks.svelte`) and, through `src/kitcms.admin.ts`, as the live preview.
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
	fields: { body: f.richText() },
});

const Features = block({
	slug: 'features',
	fields: {
		title: f.text(),
		items: f.array({
			maxRows: 12,
			labels: { singular: 'Feature', plural: 'Features' },
			fields: {
				title: f.text({ required: true }),
				text: f.textarea(),
				icon: f.select({ options: ICONS }),
			},
		}),
	},
});

const Gallery = block({
	slug: 'gallery',
	fields: { images: f.upload({ relationTo: 'media', hasMany: true }) },
});

const Cta = block({
	slug: 'cta',
	labels: { singular: 'Call to action', plural: 'Calls to action' },
	fields: {
		heading: f.text({ required: true }),
		text: f.textarea(),
		buttonLabel: f.text({ required: true }),
		buttonHref: f.text({ required: true, admin: { placeholder: '/contact or https://...' } }),
	},
});

const TeamGrid = block({
	slug: 'teamGrid',
	labels: { singular: 'Team grid', plural: 'Team grids' },
	// Renders the `team` collection, in the order editors set there.
	fields: { title: f.text() },
});

const LatestPosts = block({
	slug: 'latestPosts',
	labels: { singular: 'Latest posts', plural: 'Latest posts' },
	fields: {
		title: f.text(),
		count: f.number({ integer: true, min: 1, max: 12, defaultValue: 3 }),
	},
});

const pageBlocks = [Hero, RichText, Features, Gallery, Cta, TeamGrid, LatestPosts] as const;

// ---------------------------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------------------------

export default defineConfig({
	admin: { title: '__APP_NAME__' },
	// Edge cache for anonymous published reads. Needs a custom domain: the Workers Cache API does
	// nothing on *.workers.dev. Writes clear it in the writer's region at once; other regions
	// serve a cached read for up to `ttl` seconds.
	cache: { ttl: 60 },
	collections: [
		collection({
			slug: 'media',
			upload: { mimeTypes: ['image/*', 'application/pdf'] },
			access: { read: () => true },
			fields: { alt: f.text({ label: 'Alt text' }) },
		}),
		collection({
			slug: 'pages',
			// Drafts + autosave: anonymous reads only ever see published pages.
			versions: { drafts: { autosave: true } },
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'] },
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				// `home` is the page served at `/`. `blog` and `legal` are taken by the routes.
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				content: f.tabs({
					tabs: [
						{ label: 'Content', fields: { sections: f.blocks({ blocks: pageBlocks }) } },
						{
							label: 'SEO',
							fields: {
								seo: f.group({
									fields: {
										metaTitle: f.text({ maxLength: 70 }),
										metaDescription: f.textarea({ maxLength: 160 }),
										image: f.upload({ relationTo: 'media', label: 'Social image' }),
									},
								}),
							},
						},
					],
				}),
			},
		}),
		collection({
			slug: 'posts',
			versions: { drafts: true },
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'publishedAt', '_status'] },
			defaultSort: '-publishedAt',
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				publishedAt: f.date({ admin: { position: 'sidebar' } }),
				tags: f.relationship({ relationTo: 'tags', hasMany: true, admin: { position: 'sidebar' } }),
				excerpt: f.textarea({ maxLength: 300 }),
				cover: f.upload({ relationTo: 'media' }),
				body: f.richText(),
			},
		}),
		collection({
			slug: 'tags',
			admin: { useAsTitle: 'name' },
			access: { read: () => true },
			fields: {
				name: f.text({ required: true }),
				slug: f.slug({ from: 'name', unique: true }),
			},
		}),
		collection({
			slug: 'team',
			// Drag to reorder in the admin list; `find` returns members in that order.
			orderable: true,
			admin: { useAsTitle: 'name', defaultColumns: ['name', 'role'] },
			access: { read: () => true },
			fields: {
				name: f.text({ required: true }),
				role: f.text(),
				photo: f.upload({ relationTo: 'media' }),
				bio: f.textarea(),
			},
		}),
		collection({
			slug: 'legal',
			// A fixed set of documents: editors can edit them but not create or delete them.
			// `pnpm db:seed` creates them.
			admin: { locked: true, useAsTitle: 'title', defaultColumns: ['title', 'slug', 'updatedAt'] },
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				body: f.richText(),
			},
		}),
	],
	globals: [
		global({
			slug: 'site',
			label: 'Site settings',
			versions: { drafts: true },
			access: { read: () => true },
			fields: {
				siteName: f.text({ required: true }),
				tagline: f.textarea(),
				logo: f.upload({ relationTo: 'media' }),
				// Each item links to a page or, for routes that are not pages (`/blog`), to a path.
				nav: f.array({
					labels: { singular: 'Link', plural: 'Navigation' },
					fields: {
						label: f.text({ required: true }),
						page: f.relationship({ relationTo: 'pages' }),
						href: f.text({ admin: { description: 'Used when no page is chosen, e.g. /blog' } }),
					},
				}),
				footer: f.group({
					fields: {
						text: f.textarea(),
						social: f.array({
							labels: { singular: 'Link', plural: 'Social links' },
							fields: { label: f.text({ required: true }), url: f.text({ required: true }) },
						}),
					},
				}),
			},
		}),
	],
});
