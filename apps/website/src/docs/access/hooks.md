---
title: Hooks
description: Run your code before and after reads, writes and deletes, in a defined order.
order: 3
---

This page lists every collection and field hook, the order they run in and what each may return.

## Collection hooks

Set `hooks` on a collection. Each hook can be a function or an array of functions, which run in order.

```ts title="src/kitcms.config.ts"
import { collection, fields as f } from '@kitcms/core';

export const posts = collection({
	slug: 'posts',
	access: { read: () => true },
	hooks: {
		beforeChange: ({ data, operation, req }) => {
			if (operation === 'create' && req.user) return { ...data, author: req.user.id };
		},
		afterChange: ({ doc, req }) => {
			req.context.changed = doc.id;
		},
		afterRead: ({ doc }) => ({ ...doc, title: doc.title.trim() }),
	},
	fields: {
		title: f.text({ required: true }),
		author: f.text(),
	},
});
```

| Hook | Arguments | May return |
|---|---|---|
| `beforeValidate` | `{ req, operation, data, originalDoc? }` | A replacement `data` (or a partial), or nothing. |
| `beforeChange` | `{ req, operation, data, originalDoc? }` | A replacement `data`, or nothing. |
| `afterChange` | `{ req, operation, doc, previousDoc? }` | A replacement `doc`, or nothing. |
| `beforeRead` | `{ req, doc }` | A replacement `doc`, or nothing. |
| `afterRead` | `{ req, doc }` | A replacement `doc`, or nothing. |
| `beforeDelete` | `{ req, id, doc }` | Nothing. Throw to stop the delete. |
| `afterDelete` | `{ req, id, doc }` | Nothing. |

`operation` is `'create'` or `'update'`. Returning nothing keeps the input. When a hook returns a value, the next hook receives it. Globals take the same hooks except the delete ones.

Keys that hooks add to `data` and that are not fields never reach D1.

## Order

**Create and update**

1. Access check, then field write access.
2. Defaults and slug filling.
3. Collection `beforeValidate`, then field `beforeValidate`.
4. Validation.
5. Field `beforeChange`, then collection `beforeChange`.
6. D1 write.
7. Field `afterChange`, then collection `afterChange`.
8. The read steps below, for the returned document.

**Read**

1. Access check and D1 query.
2. Collection `beforeRead`.
3. Field read access (denied fields are removed).
4. Field `afterRead`.
5. The file `url` is computed for upload collections.
6. Collection `afterRead`.
7. Relationship population, when you ask for `depth`.

**Delete**

1. Access check.
2. `beforeDelete`.
3. D1 delete. This fails if other documents still reference the document.
4. `afterDelete`.

Read hooks run for every document a `find` returns, so keep them cheap.

## Field hooks

Fields take `hooks` with `beforeValidate`, `beforeChange`, `afterChange` and `afterRead`.

```ts
slugified: f.text({
	hooks: {
		beforeChange: ({ value }) => (typeof value === 'string' ? value.toLowerCase() : value),
	},
}),
```

A field hook gets `{ req, operation, value, originalDoc?, data, siblingData }`. Return a new value, or nothing to keep it. Containers run before their children, and field hooks reach into groups, array rows and blocks.

## `req`

Every hook receives the operation's `req`:

| Property | What it is |
|---|---|
| `user` | The caller, or `null`. |
| `source` | `'local'`, `'admin'`, `'rpc'` or `'rest'`. |
| `context` | A free-form object shared by every hook of one operation. |
| `cms` | The Local API, acting as the same user. |
| `event` | The SvelteKit request, when there is one. |

## Call the Local API from a hook

Pass `{ req }` to nested calls. They then share the user and `context`, so your access rules and hooks see the same caller:

```ts
afterChange: async ({ doc, req }) => {
	await req.cms.update('stats', 'posts', { count: 1 }, { req });
},
```

Nested writes run the full pipeline too, so they can trigger hooks of their own. Guard against loops with `req.context`:

```ts
afterChange: async ({ doc, req }) => {
	if (req.context.fromPostHook) return;
	await req.cms.update('audit', auditId, { last: doc.id }, { req, context: { fromPostHook: true } });
},
```

## Errors

Throw `ValidationError`, `ForbiddenError` or `NotFoundError` from `@kitcms/core` in a hook and every entry point maps it to the same response: a field error in the admin, `400`, `403` or `404` over REST and a typed error over RPC.

```ts
import { ForbiddenError } from '@kitcms/core';

beforeDelete: ({ doc }) => {
	if (doc.locked) throw new ForbiddenError('This document is locked.');
},
```
