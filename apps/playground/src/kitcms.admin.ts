// Playground live previews. Every block previews through the real site components (same designs and
// tokens as the public page); the `site` global has its own header-style preview.
import { defineAdmin } from '@kitcms/ui';

const block = () => import('#lib/site/blocks/AdminPreview.svelte');

export default defineAdmin({
	previews: {
		globals: { site: () => import('#lib/SitePreview.svelte') },
		blocks: {
			hero: block,
			features: block,
			richText: block,
			split: block,
			gallery: block,
			cta: block,
			stats: block,
			roomsList: block,
			experiencesList: block,
			testimonials: block,
			faq: block,
			quote: block,
			location: block,
			offers: block,
		},
	},
});
