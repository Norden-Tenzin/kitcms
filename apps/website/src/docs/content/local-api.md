---
title: The Local API
description: Read and write content with locals.cms, including where, sort, depth, drafts and every method.
order: 2
---

This page documents the Local API: the methods on `locals.cms`, the options they take and how errors surface.

`locals.cms` acts as the request's user. On public routes that is an anonymous visitor, so a read returns only what a signed-out visitor may see. It is typed from your config, so collection slugs, field names and results are checked.

```ts title="src/routes/blog/[slug]/+page.server.ts"
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const post = await locals.cms.findOne('posts', {
		where: { slug: { equals: params.slug } },
		depth: 1,
	});
	if (!post) error(404, 'Not found');
	return { post };
};
```

## Reads

| Method | Returns |
|---|---|
| `find(collection, args?)` | `{ docs, totalDocs, limit, page, totalPages, hasNextPage, hasPrevPage }` |
| `findOne(collection, args?)` | The first match, or `null`. |
| `findByID(collection, id, options?)` | The document, or `null` if it does not exist or the caller may not read it. |
| `count(collection, args?)` | A number. |
| `findGlobal(global, options?)` | The global. Never `null`: an unsaved global returns its defaults. |

### `find` arguments

| Argument | What it does |
|---|---|
| `where` | A filter. See below. |
| `sort` | A field name, with `-` for descending: `'title'`, `'-createdAt'`. One field. Default: the collection's `defaultSort`, else `'-createdAt'`. Ties break on `id`. |
| `limit` | Page size. Default 10, maximum 1000. |
| `page` | 1-based. Default 1. |
| `depth` | How many levels of relationships to load: `0`, `1` or `2`. Default `0`. |
| `pagination` | `false` skips the total count, so `totalDocs` and `totalPages` are missing. Saves a query. |
| `draft` | Include drafts. See below. |
| `overrideAccess` | Skip access rules. Trusted code only. |

```ts
const { docs, totalDocs } = await locals.cms.find('posts', {
	where: { publishedAt: { less_than_equal: new Date().toISOString() } },
	sort: '-publishedAt',
	limit: 12,
	page: 2,
	depth: 1,
});
```

`findOne` takes the same arguments except `limit`, `page` and `pagination`.

## `where`

A `where` object is a conjunction: every field and every `and` or `or` entry must hold. `{}` matches everything.

```ts
where: {
	status: { equals: 'published' },
	or: [{ title: { like: 'kit' } }, { tags: { contains: tagId } }],
}
```

| Operator | On | Meaning |
|---|---|---|
| `equals`, `not_equals` | Any value | Equal, or not equal. `equals: null` matches missing values. |
| `in`, `not_in` | Any value | In, or not in, a list. |
| `exists` | Any value | `true` is not null, `false` is null. |
| `greater_than`, `greater_than_equal`, `less_than`, `less_than_equal` | Numbers and dates | Range. |
| `like` | Strings | Case-insensitive substring match. `%`, `_` and `\` are escaped, so it is not a pattern language. |
| `contains` | `hasMany` relationships | The list includes this ID. `in` and `not_in` work too. |

- Several operators on one field are ANDed.
- `or: []` matches nothing. `and: []` matches everything.
- Dates accept an ISO string, a `Date` or epoch milliseconds.
- You can filter on `id`, `createdAt`, `updatedAt`, top-level column fields and top-level `hasMany` relationships. Fields stored as JSON (group, array, blocks, json, richText) cannot be filtered. An unknown or non-filterable field throws a `QueryError`.
- An access rule's filter is added as a separate AND group, so your `where` can never widen it. See [Access rules](../access/rules.md).

## Relationships and `depth`

At `depth: 0`, a relationship is an ID. At `depth: 1` it is the document, and at `depth: 2` the documents inside those. The maximum is 2.

```ts
const post = await locals.cms.findByID('posts', id, { depth: 1 });
post?.cover; // a media document; or a string ID if it is missing or not readable
```

A target that is missing or that the caller may not read stays an ID, so its type is the document or `string`. Population runs as one batched D1 query per level, not one per document.

## Drafts

For collections and globals with [drafts](../configuration/drafts-and-versions.md), reads return published documents only. Pass `draft: true` to see the latest draft. It needs a signed-in user or `overrideAccess`.

```ts
const preview = await locals.cms.findByID('pages', id, { draft: true });
```

## Writes

| Method | What it does |
|---|---|
| `create(collection, data, options?)` | Creates a document. Returns it. |
| `update(collection, id, data, options?)` | Partial update. Returns the document. |
| `delete(collection, id, options?)` | Deletes and returns the document. |
| `updateGlobal(global, data, options?)` | Partial update of a global. Creates it on the first save. |
| `move(collection, id, { before } or { after })` | Reorders a document in an orderable collection. |
| `unpublish(collection, id)` | Takes a published document offline. |
| `findVersions`, `findVersionByID`, `restoreVersion` | Version history. Globals have `findGlobalVersions` and `restoreGlobalVersion`. |

Write options: `depth` (depth of the returned document), `draft` (save as a draft), `autosave` (with `draft`), `overrideAccess`, `req` and `context`.

```ts
const post = await locals.cms.create('posts', { title: 'Hello' });
await locals.cms.update('posts', post.id, { title: 'Hello, world' });
await locals.cms.delete('posts', post.id);
```

Writes run through your access rules as the caller. On a public route `locals.cms` is anonymous, so the default rules deny writes there. Make content changes in the admin, or in trusted server code with `overrideAccess: true`. Never pass `overrideAccess` based on request input.

## Errors

Operations throw errors that extend `KitcmsError`, each with a `code` and an HTTP `status`:

| Error | When | Status |
|---|---|---|
| `ValidationError` | Invalid data. Has `errors`, a list of `{ path, message }`. | 400 |
| `ForbiddenError` | An access rule denied the operation. | 403 |
| `UnauthorizedError` | The caller must sign in. | 401 |
| `NotFoundError` | The document does not exist (`update`, `move`, `delete`). | 404 |
| Referenced (code `REFERENCED`) | You deleted a document that others still reference. | 409 |
| Query (code `QUERY`) | A bad `where`, `sort` or option. | 400 |

`@kitcms/core` exports `KitcmsError`, `ValidationError`, `ForbiddenError`, `UnauthorizedError`, `NotFoundError` and `isKitcmsError`. Check the others by `code`.

```ts
import { isKitcmsError, ValidationError } from '@kitcms/core';

try {
	await locals.cms.create('posts', input);
} catch (err) {
	if (err instanceof ValidationError) return Response.json({ errors: err.errors }, { status: 400 });
	if (isKitcmsError(err)) return Response.json({ code: err.code }, { status: err.status });
	throw err;
}
```

## Performance

A depth-1 populated read takes two sequential D1 round trips. A write takes two (a create takes one). To make anonymous reads faster still, turn on the [edge cache](../deploy/edge-cache.md).
