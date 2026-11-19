---
title: Configuration
description: The kitcms.config.ts file, where collections, globals and every top-level option are defined.
order: 1
---

This page covers `src/kitcms.config.ts`, the one file that defines your schema, and the options you can set at the top level.

The schema is code only: no admin screen creates or edits collections, fields or blocks. That keeps the schema in git, reviewable in pull requests and identical across environments.

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

`defineConfig()` returns its argument at runtime. Its job is to compute the document types once, so `locals.cms` is typed. You register that type in `src/app.d.ts` (see the [project tour](../getting-started/project-tour.md)).

## Where things go

| Topic | Page |
|---|---|
| Collections and their options | [Collections](./collections.md) |
| Every field type | [Fields](./fields.md) |
| Single documents such as site settings | [Globals](./globals.md) |
| Page sections made of blocks | [Blocks](./blocks.md) |
| Drag-and-drop order, fixed sets of documents | [Orderable and locked collections](./orderable-and-locked.md) |
| Drafts, history and autosave | [Drafts and versions](./drafts-and-versions.md) |
| Preview components in the admin | [Live preview](./live-preview.md) |
| Title and logo | [Admin branding](./admin-branding.md) |
| Values that differ per deployment | [Per-request values](./per-request-values.md) |

## Top-level options

`defineConfig()` takes `collections` and these options. All are optional.

| Option | What it does |
|---|---|
| `globals` | An array of `global()` definitions. See [Globals](./globals.md). |
| `admin.title` | Shown in the admin header and browser title. Default `'kitcms'`. Can be a function. See [Per-request values](./per-request-values.md). |
| `admin.branding` | Logo and accent colours. See [Admin branding](./admin-branding.md). |
| `admin.user` | Slug of the auth collection. Defaults to the collection marked `auth: true`, else a built-in `users` collection. See [Auth and users](../auth/index.md). |
| `media.publicUrl` | Public base URL of the R2 bucket, such as `https://media.example.com`. Without it, the Worker serves files under `/api/media/`. See [Media](../media/index.md). |
| `rest` | `false` turns off the REST API under `/api/collections` and `/api/globals`. Default `true`. See [REST](../content/rest.md). |
| `cache` | `{ ttl: seconds }` turns on the edge cache for anonymous reads. Default off. See [Edge cache](../deploy/edge-cache.md). |
| `email` | `{ from: { address, name? }, replyTo? }`. The sender for outgoing email. `from` and `replyTo` can be functions. See [Email](../auth/email.md). |
| `system` | `{ secret?, seeds? }`. Setup endpoints for hosting platforms. Off unless a token is set. See [System setup](../deploy/system-setup.md). |
| `bindings` | Names of the Worker bindings. Default `{ db: 'DB', bucket: 'BUCKET', email: 'EMAIL' }`. |
| `plugins` | An array of plugins. See [Plugins](../plugins/index.md). |
| `entitlements` | A provider that gates add-ons. Set by `@kitcms/plugin-entitlements`. See [Entitlements](../plugins/entitlements.md). |

## Migrations

When you change the config, generate a migration and apply it:

```sh
pnpm db:generate add-subtitle   # kitcms migrate:create: a migration from the config
pnpm db:migrate                 # apply it to the local D1
```

kitcms turns the config into table definitions, and drizzle-kit writes the SQL into `migrations/`. Wrangler applies it. D1 has no interactive transactions, which is why kitcms writes through `batch()` calls and keeps migrations as plain SQL files.

Read the SQL before you apply it. Renaming a field or collection appears as a drop and an add, and drops the data.

To apply migrations to production, see [Deploy and operate](../deploy/index.md).

## Storage in short

- Simple fields (`text`, `number`, `select`, `date`, `checkbox`, single `relationship`) are real columns, so you can filter and sort on them.
- Nested fields (`group`, `array`, `blocks`, `json`, `richText`) are stored as JSON in one text column. You cannot filter on them.
- IDs are ULIDs. Dates are ISO 8601 strings in documents.
