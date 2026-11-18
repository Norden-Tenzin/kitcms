<script lang="ts">
	// Responsive picture: `srcset` through Cloudflare Image Transformations (`/cdn-cgi/image`, a no-op in
	// dev and on *.workers.dev), explicit width/height (no layout shift), lazy unless `eager` (LCP).
	import { dev } from '$app/env';
	import { page } from '$app/state';
	import { imageUrl } from './image';
	import type { Media } from './media';

	interface Props {
		media: Media | null | undefined;
		/** Widths (px) offered in `srcset`. The middle one is the fallback `src`. */
		widths?: number[];
		/** Describe the rendered width, e.g. `(min-width: 60rem) 50vw, 100vw`. */
		sizes?: string;
		/** Crop to this width / height ratio (`cover`). */
		ratio?: number;
		/** `cover` fills its parent (set the parent's size); `natural` keeps the picture's shape. */
		fit?: 'natural' | 'cover';
		eager?: boolean;
		/** Override the media's alt text (decorative: pass ''). */
		alt?: string;
		class?: string;
	}
	let {
		media,
		widths = [480, 960, 1600],
		sizes = '100vw',
		ratio,
		fit = 'natural',
		eager = false,
		alt,
		class: className,
	}: Props = $props();

	const enabled = $derived(!dev && !page.url.hostname.endsWith('.workers.dev'));
	const fallback = $derived(widths[Math.floor(widths.length / 2)] ?? 960);
	const build = (w: number) =>
		media
			? imageUrl(media.url, { width: w, height: ratio ? w / ratio : undefined, fit: ratio ? 'cover' : 'scale-down' }, enabled)
			: '';
	const srcset = $derived(enabled ? widths.map((w) => `${build(w)} ${w}w`).join(', ') : undefined);
	const w = $derived(ratio && media?.width ? media.width : (media?.width ?? undefined));
	const h = $derived(ratio && media?.width ? Math.round(media.width / ratio) : (media?.height ?? undefined));
</script>

{#if media}
	<img
		class={['img', fit === 'cover' && 'cover', className]}
		src={build(fallback)}
		{srcset}
		{sizes}
		alt={alt ?? media.alt ?? ''}
		width={w}
		height={h}
		loading={eager ? 'eager' : 'lazy'}
		fetchpriority={eager ? 'high' : undefined}
		decoding="async"
		style:aspect-ratio={ratio}
	/>
{/if}

<style>
	.cover {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
