// Playground live previews. `pages` uses the default blocks preview (hero + features have
// previews); `site` has a global preview.
import { defineAdmin } from '@kitcms/ui';

export default defineAdmin({
	previews: {
		globals: { site: () => import('#lib/SitePreview.svelte') },
		blocks: {
			hero: () => import('#lib/HeroPreview.svelte'),
			features: () => import('#lib/FeaturesPreview.svelte'),
		},
	},
});
