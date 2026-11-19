---
title: Blocks
description: Build page sections from block types with block() and the blocks field.
order: 5
---

This page shows how to define block types and use them in a `blocks` field, so editors can compose pages from sections you control.

A block is a named set of fields, such as a hero or a call to action. A `blocks` field holds an ordered list of them. Editors can only add the block types you list, so the layout stays inside your design.

## Define blocks

```ts title="src/kitcms.config.ts"
import { block, collection, fields as f } from '@kitcms/core';

const Hero = block({
	slug: 'hero',
	fields: {
		heading: f.text({ required: true }),
		subheading: f.textarea(),
		image: f.upload({ relationTo: 'media' }),
	},
});

const Cta = block({
	slug: 'cta',
	labels: { singular: 'Call to action', plural: 'Calls to action' },
	fields: {
		heading: f.text({ required: true }),
		buttonLabel: f.text({ required: true }),
		buttonHref: f.text({ required: true }),
	},
});

const pageBlocks = [Hero, Cta] as const;

export const pages = collection({
	slug: 'pages',
	versions: { drafts: { autosave: true } },
	access: { read: () => true },
	fields: {
		title: f.text({ required: true }),
		sections: f.blocks({ blocks: pageBlocks }),
	},
});
```

Declare the list `as const`. That keeps each block's slug as a literal type, which the document type needs.

## Block options

| Option | What it does |
|---|---|
| `slug` | Stored as `blockType` on each block. Unique within one `blocks` field. Required. |
| `fields` | The block's fields. Required. |
| `labels` | `{ singular, plural }` for the admin. |

## What a stored block looks like

Each block in the list is an object with its own `id`, its `blockType` and its fields:

```json
{ "id": "01J...", "blockType": "hero", "heading": "Welcome" }
```

The type of `sections` is a union of the block shapes, so checking `blockType` narrows it:

```ts
for (const block of page.sections) {
	if (block.blockType === 'hero') console.log(block.heading);
}
```

## Render blocks on your site

You write the components. Map each `blockType` to one:

```svelte title="src/lib/blocks/RenderBlocks.svelte"
<script lang="ts">
	import Hero from './Hero.svelte';
	import Cta from './Cta.svelte';

	let { blocks } = $props();
</script>

{#each blocks as block (block.id)}
	{#if block.blockType === 'hero'}
		<Hero {block} />
	{:else if block.blockType === 'cta'}
		<Cta {block} />
	{/if}
{/each}
```

The `website` template does this with seven blocks. To add one, define it with `block()`, add a component, add a branch in `RenderBlocks.svelte` and register a preview in `src/kitcms.admin.ts`.

## Preview blocks in the admin

Preview components are registered per block slug in `src/kitcms.admin.ts`, not in the config. See [Live preview](./live-preview.md).

## Why blocks have no preview option in the config

The config is server code. A Svelte component is browser code, so previews live in a separate client-safe file.
