# @kitcms/plugin-seo

Adds an SEO `meta` group (title, description, image, noIndex) to chosen collections and globals,
plus helpers to render it on the site and preview it in the admin.

## Install

```sh
pnpm add @kitcms/plugin-seo
```

## Config

```ts
// src/kitcms.config.ts
import { defineConfig } from '@kitcms/core';
import { seo } from '@kitcms/plugin-seo';

export default defineConfig({
	collections: [pages, media],
	plugins: [
		seo({
			collections: ['pages'],
			globals: ['settings'],
			uploadsCollection: 'media', // omit for no image field
			// fieldName: 'meta', titleMaxLength: 60, descriptionMaxLength: 160 (hints only)
		}),
	],
});
```

`seo()` throws (message starts with `seo: `) when a listed slug does not exist, the target already has a field
named `fieldName`, or `uploadsCollection` is not an `upload: true` collection.

## Redirects, sitemap and robots.txt

```ts
seo({
	collections: ['pages', 'rooms'],
	redirects: true, // or { collection: 'redirects', cacheTtl: 60 }
	sitemap: {
		collections: {
			pages: (doc) => (doc.slug === 'home' ? '/' : `/${doc.slug}`), // return null to skip a doc
			rooms: '/rooms/:slug', // `:field` is replaced with the doc's field, URL-encoded
		},
		paths: ['/rooms', '/journal'], // extra static paths
		origin: 'https://example.com', // default: the request's origin
	},
	robots: { disallow: ['/private'] }, // or true
});
```

The plugin answers these in its `handle` step, which runs for every site request (never `/admin*` or `/api*`)
before routing. Only `GET` and `HEAD` are handled. `path` is relative to the app's `paths.base`; the plugin works
out the base from the request URL, so redirect targets starting with `/` and sitemap URLs get the base prefix.

**Redirects.** `redirects` adds a `redirects` collection under the "SEO" admin group (default signed-in access;
reads are not public). Fields: `from` (path, unique, trailing slash ignored), `to` (a `/path` or an `http(s)://`
URL), `type` (301 or 302), `enabled`, `note`. Validation rejects a `from` under `/admin` or `/api`, a `to` that is
not a `/path` or an http(s) URL (so no `javascript:` and no `//host`), redirects to themselves and loops (the chain
of enabled redirects is followed up to 10 hops). Matching is exact on the path. The request's query string is kept
unless `to` has its own. The enabled redirects are cached per isolate for `cacheTtl` seconds (an empty list is
cached too, so a warm request does no D1 query). A write drops the cache of the isolate that handled it; other
isolates catch up within `cacheTtl`. At most 5000 enabled redirects are read.

**Sitemap.** `/sitemap.xml` is built as the anonymous visitor: only published docs the public may read, so a
collection without public read access is skipped silently. Docs with `meta.noIndex` are left out, `lastmod` is the
date part of `updatedAt`, and at most 5000 docs per collection are listed. Served as `application/xml` with
`cache-control: public, max-age=300`.

**robots.txt.** `User-agent: *`, `Disallow: /admin`, `Disallow: /api`, your extra `disallow` lines, and a
`Sitemap:` line when `sitemap` is configured. If the app has a static `robots.txt` (or `sitemap.xml`) in its
assets, the asset wins, because Cloudflare serves assets before the Worker runs.

## On the site

```svelte
<!-- src/routes/[slug]/+page.svelte -->
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

Load the page with `depth: 1` so `meta.image` is populated. With depth 0 the image is a bare id, and `getMeta`
falls back to `defaults.image` rather than returning the id.

## In the admin

```ts
// src/kitcms.admin.ts
import { defineAdmin } from '@kitcms/ui';

export default defineAdmin({
	previews: { collections: { pages: () => import('#lib/PagePreview.svelte') } },
});
```

```svelte
<!-- src/lib/PagePreview.svelte -->
<script lang="ts">
	import { SerpPreview } from '@kitcms/plugin-seo/svelte';
	let { doc } = $props();
</script>

<SerpPreview {doc} url="acme.com/{doc.slug}" defaults={{ siteName: 'Acme', titleTemplate: '%s | Acme' }} />
```

## Types

Fields added by a plugin are not part of the app's inferred `DocOf` types. Use `generate:types` for headless
consumers, or cast the `meta` value to `Parameters<typeof getMeta>[0]` (it accepts any object).
