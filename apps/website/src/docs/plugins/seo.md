---
title: SEO plugin
description: Add SEO fields, redirects, a sitemap and robots.txt with @kitcms/plugin-seo.
order: 2
---

This page covers `@kitcms/plugin-seo`: the `meta` field group, redirects, `sitemap.xml`, `robots.txt` and the components that render them.

```sh
pnpm add @kitcms/plugin-seo
```

## Add the fields

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';
import { seo } from '@kitcms/plugin-seo';

export default defineConfig({
	collections: [pages, media],
	globals: [settings],
	plugins: [
		seo({
			collections: ['pages'],
			globals: ['settings'],
			uploadsCollection: 'media',
		}),
	],
});
```

The plugin adds a `meta` group to each listed collection and global, in the sidebar. It holds `title`, `description`, `image` (when you set `uploadsCollection`) and `noIndex`.

| Option | What it does |
|---|---|
| `collections`, `globals` | Slugs to add the group to. |
| `uploadsCollection` | An `upload: true` collection for `meta.image`. Omit for no image field. |
| `fieldName` | Name of the group. Default `'meta'`. |
| `titleMaxLength` | Recommended title length, shown as a hint. Default 60. |
| `descriptionMaxLength` | Recommended description length, shown as a hint. Default 160. |
| `redirects` | `true` or `{ collection?, cacheTtl? }`. See below. |
| `sitemap` | See below. |
| `robots` | `true` or `{ disallow?: string[] }`. See below. |

`seo()` throws, with a message that starts with `seo: `, when a listed slug does not exist, a target already has a field with the same name, or `uploadsCollection` is not an upload collection.

Run a migration after you add the plugin, because it adds columns.

## Redirects

`redirects: true` adds a `redirects` collection under an "SEO" admin group. Editors manage it. Fields: `from` (a path, unique), `to` (a `/path` or an `http(s)://` URL), `type` (301 or 302), `enabled` and `note`.

- Validation rejects a `from` under `/admin` or `/api`, a `to` that is not a path or an http(s) URL (so no `javascript:` and no `//host`), redirects to themselves and loops.
- Matching is exact on the path, and a trailing slash is ignored. The request's query string is kept unless `to` has its own.
- The enabled redirects are cached in each isolate for `cacheTtl` seconds (default 60), so a request with no match does no D1 query. A write clears the cache of the isolate that handled it. Others catch up within `cacheTtl`.

## Sitemap

```ts
seo({
	collections: ['pages'],
	sitemap: {
		collections: {
			pages: (doc) => (doc.slug === 'home' ? '/' : `/${doc.slug}`), // return null to skip a document
			rooms: '/rooms/:slug', // :field is replaced with the document's field, URL-encoded
		},
		paths: ['/rooms', '/journal'], // extra static paths
		origin: 'https://example.com', // default: the request's origin
	},
});
```

`/sitemap.xml` is built as an anonymous visitor: only published documents the public may read, so a collection without public read access is skipped. Documents with `meta.noIndex` are left out. At most 5000 documents per collection are listed.

## robots.txt

`robots: true` serves `User-agent: *`, `Disallow: /admin` and `Disallow: /api`, plus a `Sitemap:` line when `sitemap` is set. Add lines with `robots: { disallow: ['/private'] }`.

If your app has a static `robots.txt` or `sitemap.xml` in its assets, the asset wins, because Cloudflare serves assets before the Worker runs.

All three are answered in the plugin's `handle` step, which runs for site requests only (never `/admin` or `/api`), for `GET` and `HEAD`.

## On the site

Load the page with `depth: 1`, so `meta.image` is a document and not a bare ID, then render the tags:

```svelte title="src/routes/[slug]/+page.svelte"
<script lang="ts">
	import { getMeta } from '@kitcms/plugin-seo';
	import { SeoHead } from '@kitcms/plugin-seo/svelte';

	let { data } = $props();
	const meta = $derived(
		getMeta(data.page, { siteName: 'Acme', titleTemplate: '%s | Acme', description: 'Default description' }),
	);
</script>

<SeoHead {meta} url={data.url} siteName="Acme" />
```

`getMeta(doc, defaults)` resolves the title (falling back to the page title), description and image with your defaults. `SeoHead` renders the title, description, robots, Open Graph and Twitter card tags.

## In the admin

`SerpPreview` shows how a page may look in search results. Register it as a live preview:

```ts title="src/kitcms.admin.ts"
import { defineAdmin } from '@kitcms/ui';

export default defineAdmin({
	previews: { collections: { pages: () => import('#lib/PagePreview.svelte') } },
});
```

```svelte title="src/lib/PagePreview.svelte"
<script lang="ts">
	import { SerpPreview } from '@kitcms/plugin-seo/svelte';
	let { doc } = $props();
</script>

<SerpPreview {doc} url="acme.com/{doc.slug}" defaults={{ siteName: 'Acme', titleTemplate: '%s | Acme' }} />
```

See [Live preview](../configuration/live-preview.md).

## Types

Fields that a plugin adds are not part of the app's inferred types. Use [generated types](../content/types.md) in headless consumers, or pass the value to `getMeta`, which accepts any object.
