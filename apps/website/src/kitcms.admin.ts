// Client-side admin options (shipped to the browser, so no server code here).
// Live preview: every block renders through the same Svelte components as the public site.
import { defineAdmin } from '@kitcms/ui';

const preview = () => import('#lib/blocks/AdminPreview.svelte');

export default defineAdmin({
	previews: {
		blocks: {
			hero: preview,
			features: preview,
			codeShowcase: preview,
			howItWorks: preview,
			requirements: preview,
			cta: preview,
			richText: preview,
		},
	},
});
