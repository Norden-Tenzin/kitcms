// The playground config: exercises every v1 field type.
import { block, collection, defineConfig, fields as f } from '@kitcms/core';
import HeroPreview from '#lib/HeroPreview.svelte';
import { benchBlocks } from '#lib/bench/blocks.ts';

const Hero = block({
	slug: 'hero',
	fields: {
		heading: f.text({ required: true }),
		subheading: f.textarea(),
		image: f.upload({ relationTo: 'media' }),
	},
	admin: { preview: HeroPreview },
});

const Features = block({
	slug: 'features',
	fields: {
		title: f.text(),
		items: f.array({
			fields: {
				label: f.text({ required: true }),
				icon: f.select({ options: ['wifi', 'pool', 'spa', 'parking'] }),
			},
			maxRows: 6,
		}),
	},
});

export default defineConfig({
	admin: { title: 'kitcms dev' },
	collections: [
		collection({
			slug: 'media',
			upload: { mimeTypes: ['image/*', 'application/pdf'] },
			access: { read: () => true },
			fields: { alt: f.text() },
		}),
		collection({
			slug: 'pages',
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'status', 'updatedAt'] },
			access: {
				// Published pages are public; signed-in users see drafts too.
				read: ({ req }) => (req.user ? true : { status: { equals: 'published' } }),
			},
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
				status: f.select({
					options: ['draft', 'published'],
					defaultValue: 'draft',
					required: true,
					admin: { position: 'sidebar' },
				}),
				publishedAt: f.date({ admin: { position: 'sidebar', condition: (d) => d.status === 'published' } }),
				featured: f.checkbox({ admin: { position: 'sidebar' } }),
				content: f.tabs({
					tabs: [
						{
							label: 'Content',
							fields: {
								cover: f.upload({ relationTo: 'media' }),
								sections: f.blocks({ blocks: [Hero, Features] }),
							},
						},
						{
							label: 'SEO',
							fields: {
								seo: f.group({
									fields: {
										metaTitle: f.text({ maxLength: 70 }),
										metaDescription: f.textarea({ maxLength: 160 }),
										noindex: f.checkbox(),
									},
								}),
							},
						},
					],
				}),
				parent: f.relationship({ relationTo: 'pages' }),
				related: f.relationship({ relationTo: 'pages', hasMany: true }),
				gallery: f.upload({ relationTo: 'media', hasMany: true }),
				views: f.number({ integer: true, min: 0 }),
				contactEmail: f.email(),
				extra: f.json<{ notes?: string }>(),
			},
		}),
		// Benchmarks only (scripts/bench, /spike/bench). Hidden from the admin.
		collection({
			slug: 'bench',
			admin: { hidden: true, useAsTitle: 'slug' },
			access: { read: () => true },
			fields: { slug: f.text({ unique: true }), sections: f.blocks({ blocks: benchBlocks }) },
		}),
	],
});
