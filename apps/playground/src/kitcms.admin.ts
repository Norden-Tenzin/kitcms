// Playground live previews. Every block previews through the real site components (the same tokens
// and designs as the public page); the `site` global has its own header-style preview.
import { defineAdmin } from '@kitcms/ui';

const block = () => import('#lib/site/blocks/AdminPreview.svelte');

export default defineAdmin({
	previews: {
		globals: { site: () => import('#lib/site/SitePreview.svelte') },
		blocks: {
			hero: block,
			richText: block,
			features: block,
			split: block,
			gallery: block,
			stats: block,
			quote: block,
			faq: block,
			cta: block,
			servicesList: block,
			projectsList: block,
			testimonials: block,
			teamGrid: block,
			latestPosts: block,
			offers: block,
		},
	},
});
