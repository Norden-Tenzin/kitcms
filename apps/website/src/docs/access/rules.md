---
title: Access rules
description: Write collection, field and admin access rules, and learn the defaults and how rules merge with queries.
order: 2
---

This page covers access rules: what they return, what happens when you omit one, how a filter from a rule merges with the caller's query and how field-level rules work.

## Collection rules

Set `access` on a collection with any of `read`, `create`, `update` and `delete`:

```ts title="src/kitcms.config.ts"
import { collection, fields as f } from '@kitcms/core';

export const pages = collection({
	slug: 'pages',
	access: {
		// Published pages are public. Signed-in users see everything.
		read: ({ req }) => (req.user ? true : { status: { equals: 'published' } }),
		create: ({ req }) => req.user?.role === 'admin',
		update: ({ req }) => req.user !== null,
		delete: ({ req }) => req.user?.role === 'admin',
	},
	fields: {
		title: f.text({ required: true }),
		status: f.select({ options: ['draft', 'published'], defaultValue: 'draft', required: true }),
	},
});
```

A rule gets `{ req, id?, data? }` and returns, synchronously or as a promise:

| Return | Meaning |
|---|---|
| `true` | Allow. |
| `false` | Deny. |
| A `where` object | Allow only documents that match it. Not allowed for `create`. |

Anything else denies. A rule that returns a string, `undefined` or a truthy non-boolean is treated as `false`. A rule that throws fails the operation. kitcms fails closed on purpose.

`id` is the document ID for operations on one document. `data` is the incoming data for create and update.

## Defaults

When you omit a rule, the default is **signed-in users only**. A new collection is private. For public content, add `read: () => true`.

The auth (users) collection has stricter defaults: only admins create and delete users, a user can update their own document, and admins can update anyone. Its `role` and `emailVerified` fields are writable by admins only. See [Auth and users](../auth/index.md).

## Rules that return a filter

When `read`, `update` or `delete` returns a `where`, kitcms adds it to the query as a separate group joined with AND. The caller's own filter can never widen it, even with `or`:

```ts
// Rule: { status: { equals: 'published' } }
// Caller: find('pages', { where: { or: [{ title: { like: 'a' } }, { status: { equals: 'draft' } }] } })
// Runs as: (caller's where) AND (status = 'published')
```

- **`find`, `findOne`, `count`:** the filter limits which documents come back.
- **`findByID`:** a document that does not match reads as not found (`null`).
- **`update`, `delete`:** the filter is checked against the stored document, so a caller cannot change a document they cannot see.

Rules can only filter on fields that `where` supports: top-level column fields. See [The Local API](../content/local-api.md).

## Read access and relationships

A relationship you populate (with `depth`) goes through the target collection's read rule too. A target that is missing or that the caller cannot read stays an ID.

## Field-level access

Each field takes `access: { read, create, update }`. These rules return booleans only.

```ts
secretNote: f.text({
	access: {
		read: ({ req }) => req.user?.role === 'admin',
		update: ({ req }) => req.user?.role === 'admin',
	},
}),
```

| Rule | When it denies |
|---|---|
| `read` | The field is removed from the returned document. |
| `create` | The input value is dropped, and the default applies. |
| `update` | The input value is dropped, and the stored value stays. |

Field rules apply inside groups, array rows and blocks. A denied group or array is removed as a whole. Field rules get `{ req, id?, data?, siblingData? }`.

## Admin access

On the auth collection, `access.admin` decides who may use the admin panel at all:

```ts
access: { admin: ({ req }) => req.user?.role === 'admin' },
```

It must return a boolean. By default, a user may use the admin when their `role` is one of the `role` field's options.

## Globals

Globals take `access: { read, update }`. Both return booleans, and both default to signed-in users only.

## Locked and gated

- A collection with `admin.locked` denies create and delete to everyone except `overrideAccess`. See [Orderable and locked](../configuration/orderable-and-locked.md).
- A collection or global with `entitlement` is denied entirely, even for admins, while its add-on is off. `overrideAccess` still works. See [Entitlements](../plugins/entitlements.md).

## Test your rules

Write a rule as a plain function of `req`, then test it by calling the Local API with different users, or by checking responses as an anonymous visitor. Anonymous writes over REST reach the pipeline and are denied by the default rules.
