---
title: Configuration
description: Define collections, fields and globals in src/kitcms.config.ts.
order: 1
---

Your schema lives in one place, `src/kitcms.config.ts`. It is code only: there is no admin screen for creating or editing collections or fields.

```ts title="src/kitcms.config.ts"
import { collection, defineConfig, fields as f } from '@kitcms/core';

export default defineConfig({
	admin: { title: 'My site' },
	collections: [
		collection({
			slug: 'pages',
			admin: { useAsTitle: 'title' },
			access: { read: () => true },
			fields: {
				title: f.text({ required: true }),
				slug: f.slug({ from: 'title', unique: true }),
				body: f.textarea(),
			},
		}),
	],
});
```

## Fields

`text`, `textarea`, `email`, `slug`, `number`, `checkbox`, `select`, `date`, `richText`, `json`, `relationship`, `upload`, `group`, `array` and `blocks`, plus the layout-only `row`, `collapsible` and `tabs`.

Nested data (group, array, blocks, json, rich text) is stored as JSON in a text column. IDs are ULIDs.

## Migrations

After you change the config, generate a migration and apply it:

```sh
pnpm db:generate add-body   # a migration from the config
pnpm db:migrate             # apply it to the local D1
```

## Drafts and versions

```ts
collection({ slug: 'pages', versions: { drafts: { autosave: true }, max: 20 }, fields: { /* ... */ } });
```

The table holds the published state. Reads without `draft: true` only return published documents.
