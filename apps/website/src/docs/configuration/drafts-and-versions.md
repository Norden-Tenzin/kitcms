---
title: Drafts and versions
description: Keep version history, save drafts, autosave in the admin and restore old versions.
order: 7
---

This page explains the `versions` option: history, drafts, autosave and restoring an older version.

```ts title="src/kitcms.config.ts"
import { collection, fields as f } from '@kitcms/core';

export const pages = collection({
	slug: 'pages',
	versions: { drafts: { autosave: true }, max: 20 },
	access: { read: () => true },
	fields: { title: f.text({ required: true }) },
});
```

## The `versions` option

| Value | What it does |
|---|---|
| `true` | Every save also stores a version snapshot (history and restore). No drafts. |
| `{ drafts: true }` | Documents can be saved as drafts. Public reads only see published documents. |
| `{ drafts: { autosave: true } }` | Drafts, and the admin saves automatically (every 2000 ms by default). |
| `{ drafts: { autosave: { interval: 5000 } } }` | Autosave with your own interval in ms (500 or more). |
| `max` | Versions kept per document. Older ones are pruned. Default 50. |

Globals take the same option.

## How drafts work

The collection's table holds the **published** state. Drafts and history live in snapshots next to it. Collections and globals with drafts have a `_status` field, `'draft'` or `'published'`.

- **Reads without `draft: true`** return published documents only. That includes documents loaded through relationships.
- **`draft: true` on a read** returns the latest draft when it is newer than the published document, and includes documents that were never published. It needs a signed-in user or `overrideAccess`. An anonymous caller never sees drafts.
- **`update(..., { draft: true })`** saves a draft version. The published content is untouched. Required fields and `minRows` are not enforced for drafts.
- **`update(...)` without `draft`** publishes the latest draft merged with your data.
- **`unpublish(collection, id)`** takes a published document offline. It keeps its data and becomes a draft.

```ts
// Save a draft
await locals.cms.update('pages', id, { title: 'New title' }, { draft: true });

// Publish
await locals.cms.update('pages', id, { title: 'Final title' });

// Preview: read the latest draft as an editor
const page = await locals.cms.findByID('pages', id, { draft: true });

// Take it offline
await locals.cms.unpublish('pages', id);
```

For a page that renders for the public, you do not need to filter on `_status`. Anonymous reads already see only published documents.

## Autosave

With autosave on, the admin saves the form as a draft after you stop typing. It updates the latest autosave version in place instead of adding a new one each time, so autosave does not fill your history. In code, pass `autosave: true` together with `draft: true` to get the same behavior. `autosave` without `draft` is rejected.

## History and restore

In the admin, every document with versions has a Versions view that lists its snapshots and restores one. In code:

```ts
const { docs } = await locals.cms.findVersions('pages', id, { limit: 10 });
await locals.cms.restoreVersion('pages', docs[0]!.id);              // publishes it
await locals.cms.restoreVersion('pages', docs[0]!.id, { draft: true }); // as a draft
```

`findVersions`, `findVersionByID` and `restoreVersion` (and the `...Global...` variants) need read **and** update access to the document. Versions are returned newest first. `restoreVersion` writes the version's data back as an update, so access, hooks and validation run as for any update.

## Over RPC and REST

RPC callers can read drafts only with `{ as: 'system' }`. Over REST, `draft=true` on a read needs a signed-in user. See [Using content](../content/index.md).
