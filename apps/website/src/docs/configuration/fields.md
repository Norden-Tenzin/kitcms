---
title: Fields
description: Every field type kitcms supports, with its options and how it is stored.
order: 3
---

This page documents the field builders from `fields` (usually imported as `f`): the options every field shares, then each field type.

```ts
import { fields as f } from '@kitcms/core';
```

A field's name is its key in the `fields` record. Builders compute the field's TypeScript type from the options you pass, so `required: true` makes the value non-null on read.

## Options every data field has

| Option | What it does |
|---|---|
| `label` | Admin label. Default: the field name in sentence case. |
| `required` | The value must be present and non-empty. Required fields are non-null on read. |
| `defaultValue` | Used on create when the input omits the field. A function is called once per create. |
| `validate` | Custom validation. Runs on the server only. Return `true` (or nothing) when valid, or an error message. |
| `access` | Field-level rules `{ read, create, update }`. Booleans only. A denied read removes the field from the result. A denied write keeps the old value. |
| `hooks` | Field hooks: `beforeValidate`, `beforeChange`, `afterChange`, `afterRead`. See [Hooks](../access/hooks.md). |
| `admin` | Admin presentation, below. |

Built-in rules (`required`, `min`, `maxLength` and so on) run in the browser and on the server. Custom `validate` functions and `admin.condition` run on the server only.

```ts
f.text({
	validate: (value) => !value || /^#[0-9a-f]{6}$/i.test(value) || 'Use a hex colour such as #1f4e79.',
});
```

### Admin options

| Option | What it does |
|---|---|
| `description` | Help text under the input. |
| `readOnly` | Shown but not editable in the admin. Server-side writes still go through field access. |
| `hidden` | Not rendered in the admin. The value is still stored and returned. |
| `position` | `'sidebar'` puts the field in the edit view's side column. Default `'main'`. |
| `width` | CSS width inside a `row`, such as `'50%'`. |
| `placeholder` | Input placeholder. |
| `condition` | `(data, siblingData) => boolean`. Shows the field only when it returns true. Evaluated on the server on load and on every save. A hidden field keeps its value and skips validation. |

## Column options

`text`, `email`, `slug`, `number`, `select` and `date` can also set:

| Option | What it does |
|---|---|
| `index` | Adds a database index. |
| `unique` | Adds a unique index. A duplicate fails with a field error. |

## Text fields

### `text`

A single line of text.

| Option | What it does |
|---|---|
| `minLength`, `maxLength` | Length limits. |

### `textarea`

Multi-line text. Takes `minLength` and `maxLength`, and `admin.rows` for the height.

### `email`

A text field that must be an email address.

### `slug`

A URL-safe string (lowercase letters, digits and single dashes).

| Option | What it does |
|---|---|
| `from` | Name of a sibling field. When the input leaves the slug empty, kitcms fills it from that field. |

```ts
slug: f.slug({ from: 'title', unique: true, admin: { position: 'sidebar' } }),
```

A slug with `from` is optional on create.

## Numbers, booleans and dates

### `number`

| Option | What it does |
|---|---|
| `min`, `max` | Value limits. |
| `integer` | Only whole numbers are valid. |
| `admin.step` | Input step. |

### `checkbox`

A boolean. It is never null and defaults to `false`. It has no `required` option. Takes `defaultValue` and `index`.

### `select`

One value from a list.

| Option | What it does |
|---|---|
| `options` | Required. Strings, or `{ label, value }` objects. |

```ts
status: f.select({ options: ['draft', 'published'], defaultValue: 'draft', required: true }),
tone: f.select({ options: [{ label: 'Calm', value: 'calm' }, 'bold'] }),
```

With a literal list, the value type is the union of the values.

### `date`

An ISO 8601 string in documents. In the database it is an integer of milliseconds, so it sorts and filters correctly.

| Option | What it does |
|---|---|
| `admin.picker` | `'day'` or `'dayAndTime'`. |

## Rich content

### `richText`

A rich text document, edited with a Tiptap editor and stored as JSON. The value type is `RichTextDoc`.

Render it on your site with the helpers from `@kitcms/core/richtext`:

```ts
import { toHTML, toPlainText } from '@kitcms/core/richtext';

const html = toHTML(page.body);
```

`toHTML` escapes every text and attribute and checks link URLs against an allow-list of schemes, so its output is safe to inject. Options: `nodes` and `marks` for custom renderers (their output is trusted, so escape anything you take from node attributes), and `linkRel`. Also exported: `escapeHTML`, `safeHref`, `isRichTextDoc`.

### `json`

Arbitrary JSON, stored in a text column. It is never required. Pass the stored shape as a type argument:

```ts
hours: f.json<{ day: string; open: string; close: string }[]>(),
```

## Relationships and files

### `relationship`

A link to a document in another collection.

| Option | What it does |
|---|---|
| `relationTo` | Required. The slug of the target collection. |
| `hasMany` | Store an ordered list of IDs. The value is then never null: it defaults to `[]`. |
| `minRows`, `maxRows` | Limits for `hasMany`. |

On read, the value is an ID. Use `depth` to load the documents (see [The Local API](../content/local-api.md)). You can filter by a single relationship, and by `hasMany` relationships with `contains`, `in` and `not_in`.

### `upload`

A relationship to an `upload: true` collection. It takes the same options as `relationship`.

```ts
cover: f.upload({ relationTo: 'media' }),
gallery: f.upload({ relationTo: 'media', hasMany: true }),
```

See [Media](../media/index.md).

## Structure fields

### `group`

A named object of fields. It is never null on read and is stored as one JSON column.

```ts
seo: f.group({
	fields: {
		metaTitle: f.text({ maxLength: 70 }),
		metaDescription: f.textarea({ maxLength: 160 }),
	},
}),
```

Takes `fields`, plus the shared options except `required` and `defaultValue`.

### `array`

A list of rows that share the same fields. Each row gets a stable `id`. It is stored as one JSON column.

| Option | What it does |
|---|---|
| `fields` | Required. The fields of one row. |
| `minRows`, `maxRows` | Row count limits. |
| `labels` | `{ singular, plural }` for the admin. |

### `blocks`

A list of blocks, where each block is one of the block types you list. See [Blocks](./blocks.md).

| Option | What it does |
|---|---|
| `blocks` | Required. Block types made with `block()`. |
| `minRows`, `maxRows` | Block count limits. |
| `labels` | `{ singular, plural }` for the admin. |

## Layout fields

Layout fields only change how the edit view looks. They hold no data of their own: their child fields are stored as if you declared them next to the layout field.

| Field | What it does |
|---|---|
| `row` | `row({ fields })` puts its fields side by side. Use `admin.width` on children. |
| `collapsible` | `collapsible({ label, fields, admin: { initCollapsed } })` is a titled, collapsible section. |
| `tabs` | `tabs({ tabs: [{ label, description?, fields }] })` splits the edit view into tabs. |

```ts
content: f.tabs({
	tabs: [
		{ label: 'Content', fields: { body: f.richText() } },
		{ label: 'SEO', fields: { seo: f.group({ fields: { metaTitle: f.text() } }) } },
	],
}),
```

Here `body` and `seo` are top-level fields of the document. The key `content` is only a name for the layout field.

## What you can filter on

`where` works on `id`, `createdAt`, `updatedAt`, every top-level column field and top-level `hasMany` relationships. Fields stored as JSON (`group`, `array`, `blocks`, `json`, `richText`) cannot be filtered. See [The Local API](../content/local-api.md).
