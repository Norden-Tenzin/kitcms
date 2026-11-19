<script lang="ts">
	import { page } from '$app/state';
	import { getMeta } from '@kitcms/plugin-seo';
	import { SeoHead } from '@kitcms/plugin-seo/svelte';

	let {
		doc,
		siteName,
		description,
		template = true,
	}: {
		/** The page or post, loaded with `depth: 1` so `meta.image` is populated. */
		doc: Parameters<typeof getMeta>[0];
		siteName: string;
		/** Used when the document has no `meta.description`. */
		description?: string | null;
		/** Append ` | siteName` to the title. Off for the home page, whose title is already complete. */
		template?: boolean;
	} = $props();

	const meta = $derived(
		getMeta(doc, {
			siteName,
			titleTemplate: template ? `%s | ${siteName}` : undefined,
			description: description ?? undefined,
		}),
	);
</script>

<SeoHead {meta} url={page.url.href} {siteName} />
