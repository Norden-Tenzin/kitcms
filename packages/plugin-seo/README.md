# @kitcms/plugin-seo

Adds an SEO `meta` group (title, description, image, noIndex) to chosen collections and globals,
plus helpers to render it on the site and preview it in the admin.

## Install

```sh
pnpm add @kitcms/plugin-seo
```

## Config

```ts
// src/kitcms.config.ts
import { defineConfig } from '@kitcms/core';
import { seo } from '@kitcms/plugin-seo';

export default defineConfig({
	collections: [pages, media],
	plugins: [
		seo({
			collections: ['pages'],
			globals: ['settings'],
			uploadsCollection: 'media', // omit for no image field
			// fieldName: 'meta', titleMaxLength: 60, descriptionMaxLength: 160 (hints only)
		}),
	],
});
```

`seo()` throws (message starts with `seo: `) when a listed slug does not exist, the target already has a field
named `fieldName`, or `uploadsCollection` is not an `upload: true` collection.

## On the site

```svelte
<!-- src/routes/[slug]/+page.svelte -->
<script lang="ts">
	import { getMeta } from '@kitcms/plugin-seo';
	import { SeoHead } from '@kitcms/plugin-seo/svelte';

	let { data } = $props();
	const meta = $derived(
		getMeta(data.page, { siteName: 'Acme', titleTemplate: '%s | Acme', description: 'Default description' }),
	);
</script>

<SeoHead {meta} url={data.url} siteName="Acme" />
```

Load the page with `depth: 1` so `meta.image` is populated. With depth 0 the image is a bare id, and `getMeta`
falls back to `defaults.image` rather than returning the id.

## In the admin

```ts
// src/kitcms.admin.ts
import { defineAdmin } from '@kitcms/ui';

export default defineAdmin({
	previews: { collections: { pages: () => import('#lib/PagePreview.svelte') } },
});
```

```svelte
<!-- src/lib/PagePreview.svelte -->
<script lang="ts">
	import { SerpPreview } from '@kitcms/plugin-seo/svelte';
	let { doc } = $props();
</script>

<SerpPreview {doc} url="acme.com/{doc.slug}" defaults={{ siteName: 'Acme', titleTemplate: '%s | Acme' }} />
```

## Types

Fields added by a plugin are not part of the app's inferred `DocOf` types. Use `generate:types` for headless
consumers, or cast the `meta` value to `Parameters<typeof getMeta>[0]` (it accepts any object).
