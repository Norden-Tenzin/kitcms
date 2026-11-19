---
title: Orderable and locked collections
description: Let editors sort documents by drag and drop, or fix the set of documents in a collection.
order: 6
---

This page covers two collection options: `orderable`, for a manual order, and `admin.locked`, for a fixed set of documents.

## Orderable collections

Set `orderable: true` and editors drag documents into order in the admin list view.

```ts title="src/kitcms.config.ts"
import { collection, fields as f } from '@kitcms/core';

export const team = collection({
	slug: 'team',
	orderable: true,
	access: { read: () => true },
	admin: { useAsTitle: 'name' },
	fields: {
		name: f.text({ required: true }),
		role: f.text(),
	},
});
```

- kitcms adds an `_order` system field, a fractional-index string. Moving one document changes only that document's key, so a reorder is one write.
- `find` returns documents in that order by default, because `defaultSort` becomes `'_order'`.
- New documents go to the end.

Move a document in code with `move`:

```ts
await locals.cms.move('team', id, { before: otherId });
await locals.cms.move('team', id, { after: otherId });
```

`move` runs as an update with no field changes, so it needs update access. Hooks see `context.move === true`. The REST route is `POST /api/collections/:slug/:id/move` with body `{ "before": id }` or `{ "after": id }`, and RPC has `move` with `{ as: 'system' }`.

## Locked collections

Set `admin.locked: true` when the set of documents is fixed, for example legal pages that code or a seed creates.

```ts title="src/kitcms.config.ts"
import { collection, fields as f } from '@kitcms/core';

export const legal = collection({
	slug: 'legal',
	admin: { locked: true, useAsTitle: 'title' },
	access: { read: () => true },
	fields: {
		title: f.text({ required: true }),
		slug: f.slug({ from: 'title', unique: true }),
		body: f.richText(),
	},
});
```

In a locked collection, nobody can create or delete documents, whatever the access rules say. The exception is trusted code that passes `overrideAccess`: `kitcms seed` and RPC calls with `as: 'system'`. Editors can still edit existing documents, subject to `access.update`.

Create the documents with a seed. See [`kitcms seed`](../reference/cli.md).

```ts title="src/kitcms.seed.ts"
import { defineSeed } from '@kitcms/core';

export default defineSeed(async ({ ensure }) => {
	await ensure('legal', {
		where: { slug: { equals: 'privacy' } },
		data: { title: 'Privacy policy', slug: 'privacy' },
	});
});
```

`ensure` creates a document only when no document matches `where`, so running the seed again never overwrites what editors changed. Other helpers: `ensureGlobal(slug, data)` writes a global only when it was never saved, and `ensureUpload(collection, { where, file })` uploads a file into an upload collection once. Seeds run with `overrideAccess`.
