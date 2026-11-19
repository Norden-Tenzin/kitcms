---
title: Images
description: Serve resized AVIF and WebP images through Cloudflare Image Transformations and /cdn-cgi/image.
order: 2
---

This page shows how to turn an upload URL into a resized, re-encoded image with Cloudflare Image Transformations.

kitcms stores the original file. For responsive images, you ask Cloudflare to resize it on the fly with a `/cdn-cgi/image/` URL. The `website` template ships a helper for this in `src/lib/image.ts`.

## Requirements

- **A zone with Image Transformations enabled.** Turn on *Transformations* for your zone in the Cloudflare dashboard (Images).
- **A custom domain.** `/cdn-cgi/image` does nothing on `*.workers.dev` or in `vite dev`. The template turns transformations off there and serves the original file.

## The helper

```ts title="src/lib/image.ts"
export interface ImageOptions {
	width?: number;
	height?: number;
	fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
	quality?: number;
}

export function imageUrl(url: string, options: ImageOptions = {}, enabled = true): string {
	if (!enabled) return url;
	const absolute = /^https:\/\//i.test(url);
	const rootRelative = url.startsWith('/') && !url.startsWith('//');
	if (!absolute && !rootRelative) return url;
	// SVG is vector already, and the transformer would only rasterize it.
	if (/\.svg(\?|$)/i.test(url)) return url;
	const parts = ['format=auto'];
	if (options.width) parts.push(`width=${Math.round(options.width)}`);
	if (options.height) parts.push(`height=${Math.round(options.height)}`);
	if (options.fit) parts.push(`fit=${options.fit}`);
	if (options.quality) parts.push(`quality=${Math.round(options.quality)}`);
	return `/cdn-cgi/image/${parts.join(',')}${rootRelative ? '' : '/'}${url}`;
}
```

It builds `/cdn-cgi/image/format=auto,width=960/<source>`. `format=auto` serves AVIF or WebP to browsers that support them.

The `enabled` flag is how you switch it off. Pass `false` in dev and on `*.workers.dev`, and the URL comes back unchanged.

## A component

The template's `Img.svelte` builds a `srcset` from this helper. A simplified version:

```svelte title="src/lib/Img.svelte"
<script lang="ts">
	import { dev } from '$app/env';
	import { page } from '$app/state';
	import { imageUrl } from './image';

	let { src, alt, widths = [480, 960, 1600], sizes = '100vw' } = $props();

	// Transformations need a zone: not in dev and not on *.workers.dev.
	const enabled = $derived(!dev && !page.url.hostname.endsWith('.workers.dev'));
	const srcset = $derived(
		enabled ? widths.map((w: number) => `${imageUrl(src, { width: w }, enabled)} ${w}w`).join(', ') : undefined,
	);
</script>

<img {src} {srcset} {sizes} {alt} loading="lazy" />
```

Pass it the `url` of a media document. Load the document with `depth: 1` so `url` is present.

## Notes

- `$app/env` is where SvelteKit 3 exposes `dev`. It replaces `$app/environment`.
- `imageUrl` only rewrites `https://` URLs and root-relative paths (such as `/api/media/...`). Anything else, and SVG files, come back unchanged.
- The template's `Img.svelte` offers three widths by default (480, 960 and 1600), so each image has a small, fixed set of variants.
