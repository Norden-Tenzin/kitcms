---
title: Collections
description: Define a collection with collection() and set its admin, access, hooks, sorting and indexes.
order: 2
---

This page lists every option of `collection()`. A collection is a table of documents with the same fields.

```ts title="src/kitcms.config.ts"
import { collection, fields as f } from '@kitcms/core';

export const posts = collection({
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	admin: {
		useAsTitle: 'title',
		defaultColumns: ['title', 'publishedAt', 'updatedAt'],
		listSearchableFields: ['title'],
		group: 'Blog',
	},
	defaultSort: '-publishedAt',
	access: { read: () => true },
	indexes: [{ fields: ['publishedAt', 'title'] }],
	fields: {
		title: f.text({ required: true }),
		publishedAt: f.date(),
	},
});
```

Pass the result to `defineConfig({ collections: [posts] })`.

## Options

| Option | What it does |
|---|---|
| `slug` | Table name and URL segment: lowercase letters, digits, `-` and `_`. Required. |
| `fields` | A record of field definitions. The keys are the field names. Required. See [Fields](./fields.md). |
| `labels` | `{ singular, plural }` shown in the admin. Defaults are derived from the slug. |
| `admin` | Admin options, below. |
| `access` | Rules for read, create, update, delete (and `admin` on the auth collection). See [Access rules](../access/rules.md). |
| `hooks` | Collection hooks. See [Hooks](../access/hooks.md). |
| `defaultSort` | Sort for `find` and the list view, such as `'-createdAt'`. Default `'_order'` for orderable collections, else `'-createdAt'`. |
| `indexes` | Composite indexes: `[{ fields: ['a', 'b'], unique?: true }]`. Fields must be top-level column fields (or `createdAt`, `updatedAt`, `_order`, `_status`). |
| `orderable` | Editors sort documents by drag and drop. See [Orderable and locked](./orderable-and-locked.md). |
| `versions` | History and drafts. See [Drafts and versions](./drafts-and-versions.md). |
| `upload` | Makes it a file collection backed by R2. See [Uploads](../media/index.md). |
| `auth` | Marks the users collection. See [Auth and users](../auth/index.md). |
| `entitlement` | Gates the collection behind an add-on. See [Entitlements](../plugins/entitlements.md). |

### Admin options

| Option | What it does |
|---|---|
| `useAsTitle` | The field shown as the document title in lists and breadcrumbs. Default `id`. |
| `defaultColumns` | List view columns. Default: the title field, then `updatedAt`. |
| `listSearchableFields` | Text fields the list view's search box matches. Default: the title field. |
| `description` | Help text for the collection. |
| `group` | Navigation group label. |
| `hidden` | Hide the collection from the admin navigation. It stays reachable by URL and API. |
| `locked` | A fixed set of documents. See [Orderable and locked](./orderable-and-locked.md). |

## System fields

Every document has `id`, `createdAt` and `updatedAt`. Collections with drafts also have `_status` (`'draft'` or `'published'`), and orderable collections have `_order`. Upload collections add `filename`, `mimeType`, `filesize`, `width`, `height`, `key` and `url`.

You cannot use these names for your own fields.

## Defaults when you omit access

A collection with no `access` rules is private: only signed-in users can read, create, update or delete. Make content public with `read: () => true`. See [Access rules](../access/rules.md).

## References and deletes

A relationship stores the ID of another document. kitcms keeps an index of every reference, so deleting a document that other documents still point at fails with a "still referenced" error (HTTP 409) that lists them. Remove or change the references first.
