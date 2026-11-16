// SPIKE (Phase 0): stand-in for defineConfig. Imports a .svelte preview on purpose,
// to prove the Node-side generator can load the config through Vite.
import HeroPreview from '#lib/HeroPreview.svelte';
import type { SpikeConfig } from '../kitcms-spike/schema-spec.ts';

const config: SpikeConfig = {
	collections: [
		{
			slug: 'media',
			upload: true,
			fields: { alt: { type: 'text' } },
		},
		{
			slug: 'pages',
			orderable: true,
			versions: { drafts: true },
			fields: {
				title: { type: 'text', required: true },
				slug: { type: 'slug', from: 'title', unique: true },
				views: { type: 'number', index: true },
				featured: { type: 'checkbox', defaultValue: false },
				template: { type: 'select', options: ['resort', 'boutique', 'heritage'] },
				publishedAt: { type: 'date' },
				cover: { type: 'upload', relationTo: 'media' },
				parent: { type: 'relationship', relationTo: 'pages' },
				related: { type: 'relationship', relationTo: 'pages', hasMany: true },
				seo: { type: 'group', fields: { metaTitle: { type: 'text' } } },
				sections: {
					type: 'blocks',
					blocks: [
						{
							slug: 'hero',
							fields: {
								heading: { type: 'text', required: true },
								image: { type: 'upload', relationTo: 'media' },
							},
							admin: { preview: HeroPreview },
						},
					],
				},
			},
		},
	],
};

export default config;
