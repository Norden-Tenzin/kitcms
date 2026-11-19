---
title: Globals
description: Define single documents such as site settings with global().
order: 4
---

This page shows how to define a global, a single document that is not part of a collection, and how to read and update it.

Use a global for content that exists once: site settings, navigation, a footer.

```ts title="src/kitcms.config.ts"
import { defineConfig, fields as f, global } from '@kitcms/core';

const site = global({
	slug: 'site',
	label: 'Site settings',
	versions: { drafts: true },
	access: { read: () => true },
	fields: {
		siteName: f.text({ required: true }),
		tagline: f.textarea(),
		nav: f.array({
			fields: {
				label: f.text({ required: true }),
				href: f.text({ required: true }),
			},
		}),
	},
});

export default defineConfig({ collections: [], globals: [site] });
```

## Options

| Option | What it does |
|---|---|
| `slug` | Lowercase letters, digits, `-` and `_`. Unique among globals. Required. |
| `fields` | The fields, as in a collection. Required. |
| `label` | Admin label. Default: derived from the slug (`site-settings` becomes `Site settings`). |
| `admin` | `{ description?, group?, hidden? }`. |
| `access` | `{ read, update }`. Rules return booleans only. Default: signed-in users only. |
| `hooks` | The collection hooks without the delete hooks. |
| `versions` | History and drafts, as on collections. See [Drafts and versions](./drafts-and-versions.md). |
| `entitlement` | Gates the global behind an add-on. |

Each global is stored in one single-row table named `_global_<slug>`, and runs through the same pipeline as a collection.

## Read and update

```ts
const site = await locals.cms.findGlobal('site');
await locals.cms.updateGlobal('site', { tagline: 'Hello' });
```

`findGlobal` never returns `null`. A global that was never saved returns its default values. `updateGlobal` creates the row on the first save. `createdAt` and `updatedAt` are missing until then.

In the admin, globals appear in the navigation and open at `/admin/globals/<slug>`.

Over [RPC](../content/rpc.md), use `findGlobal` for reads, and `updateGlobal` with `{ as: 'system' }` for writes. Over [REST](../content/rest.md), use `GET` and `PATCH` on `/api/globals/:slug`.
