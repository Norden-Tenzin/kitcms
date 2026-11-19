---
title: Media
description: Store files in R2 with upload collections, and control types, size and public URLs.
order: 1
---

This page shows how to define an upload collection, what kitcms checks on upload and how files are served.

## Define an upload collection

Set `upload` on a collection. It stores files in your R2 bucket and the metadata in D1:

```ts title="src/kitcms.config.ts"
import { collection, fields as f } from '@kitcms/core';

export const media = collection({
	slug: 'media',
	upload: { mimeTypes: ['image/*', 'application/pdf'], maxFileSize: 10 * 1024 * 1024 },
	access: { read: () => true },
	fields: { alt: f.text({ label: 'Alt text' }) },
});
```

| Option | What it does |
|---|---|
| `upload: true` | Accept any type, up to 50 MiB. |
| `mimeTypes` | Allowed types: exact (`image/png`) or by prefix (`image/*`). Default: any. |
| `maxFileSize` | Maximum size in bytes. Default 50 MiB. |

Upload collections add these fields: `filename`, `mimeType`, `filesize`, `width`, `height`, `key` (the R2 object key) and `url` (computed on read). They are read-only in the admin and writable only through the upload endpoint. Add your own fields, such as `alt`.

You need an R2 bucket bound as `BUCKET`. See [Deploy and operate](../deploy/index.md).

## Use files in other collections

An `upload` field is a relationship to an upload collection:

```ts
cover: f.upload({ relationTo: 'media' }),
gallery: f.upload({ relationTo: 'media', hasMany: true }),
```

Load the file documents with `depth`:

```ts
const post = await locals.cms.findByID('posts', id, { depth: 1 });
// post.cover is a media document with `url`, `width` and `height`
```

In the admin, editors pick files from a media library and can upload from the field.

## What kitcms checks

- **The type comes from the bytes.** kitcms recognises PNG, JPEG, GIF, WebP, AVIF, SVG, PDF, MP4 and WebM by their content. A file that claims to be an image but is not one is stored as `application/octet-stream` and then fails an `image/*` filter.
- **Size.** Over `maxFileSize` is refused with `413`.
- **Access.** The upload endpoint (`POST /api/upload/<collection>`) needs a same-origin request from a signed-in user with admin access. The upload then goes through the collection's `create` rule, hooks and validation.
- **Dimensions.** `width` and `height` are read from the image when the format allows it.

## How files are served

By default, files are served by the Worker at `/api/media/<key>`. The Worker checks the collection's read rule for each request, so a private upload collection is private. Public files get a long cache lifetime, private ones are marked private. Responses send `x-content-type-options: nosniff` and a locked-down content security policy, support range requests and `ETag`s, and show non-image types as downloads.

To serve files straight from R2 instead, expose the bucket on a custom domain or r2.dev and set the public URL:

```ts
export default defineConfig({
	media: { publicUrl: 'https://media.example.com' },
	collections: [media],
});
```

`url` then points at that origin. This skips the Worker and its access check, so only do it for files that are public anyway.

Headless consumers need `media.publicUrl`. Without it, URLs are relative (`/api/media/...`), which another Worker cannot use. See [Headless over RPC](../content/rpc.md).

## Resized images

For responsive, modern-format images, put Cloudflare Image Transformations in front. See [Images](./images.md).

## Seeding files

`ensureUpload` in a seed uploads a file once. See [Orderable and locked](../configuration/orderable-and-locked.md).
