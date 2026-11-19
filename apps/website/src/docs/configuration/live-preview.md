---
title: Live preview
description: Show a preview pane beside the edit form with components registered in kitcms.admin.ts.
order: 8
---

This page shows how to register preview components with `defineAdmin` so editors see their content as they type.

## Why a separate file

Previews are Svelte components that run in the browser. `kitcms.config.ts` is server code, so a component cannot live there. Previews are registered in `src/kitcms.admin.ts`, which is client-safe, and loaded lazily.

```ts title="src/kitcms.admin.ts"
import { defineAdmin } from '@kitcms/ui';

export default defineAdmin({
	previews: {
		// Collections and globals: props { doc }
		collections: { pages: () => import('#lib/previews/Page.svelte') },
		globals: { site: () => import('#lib/previews/Site.svelte') },
		// Blocks: props { block, doc }
		blocks: { hero: () => import('#lib/blocks/Hero.svelte') },
	},
});
```

Keep server-only code out of this file. It ships to the browser.

## How the pane works

- The edit view shows the pane beside the form (stacked on narrow screens), with Hide/Show and Desktop/Mobile (390 px) toggles.
- A **collection or global preview** takes over the pane.
- Without one, if any `blocks` value has a registered block preview, the blocks render in document order. A block without a preview shows a labelled placeholder.
- Nothing renders on the server. The pane says "Loading preview..." and loads your component in the browser. A load or render error shows inline and never breaks the form.

## Writing a preview component

`doc` and `block` are the live form state, updated on every keystroke. They are **read-only**: never write to them.

```svelte title="src/lib/blocks/Hero.svelte"
<script lang="ts">
	import { useRelation } from '@kitcms/ui';

	let { block } = $props();
	const image = useRelation('media', () => block.image);
</script>

<section>
	<h1>{block.heading}</h1>
	{#if image.current?.url}
		<img src={image.current.url} alt="" />
	{/if}
</section>
```

Upload and relationship values are IDs. Resolve them with `useRelation(collection, () => id)`, which returns `{ current, loading }`. `current` is a `PickerDoc` with a `title` and, for uploads, `url`, `width` and `height`. Lookups are batched and cached.

## Styling

Previews render inside `.kitcms-preview`, which resets the admin typography and colours (`all: initial`, on a light canvas) so only your component styles apply. Import your site's CSS from the preview components. Svelte component styles are scoped.

## Reuse your site components

The `website` template renders every block through the same Svelte components as the public site, using one `AdminPreview.svelte` wrapper for all blocks. What editors see is what visitors get.

```ts title="src/kitcms.admin.ts"
import { defineAdmin } from '@kitcms/ui';

const preview = () => import('#lib/blocks/AdminPreview.svelte');

export default defineAdmin({
	previews: { blocks: { hero: preview, cta: preview } },
});
```
