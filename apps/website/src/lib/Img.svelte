<script lang="ts">
	import { dev } from '$app/env';
	import { page } from '$app/state';
	import { imageUrl } from './image';
	import type { Media } from './media';

	interface Props {
		media: Media | null;
		/** Widths (px) offered in `srcset`. The middle one is the fallback `src`. */
		widths?: number[];
		sizes?: string;
		/** Crop to this width / height ratio (`cover`). */
		ratio?: number;
		/** Fill the parent box (`cover`): for backgrounds. The parent sets the size. */
		fill?: boolean;
		eager?: boolean;
		/** Overrides the media's alt text (`""` marks a decorative picture). */
		alt?: string;
		class?: string;
	}
	let {
		media,
		widths = [480, 960, 1600],
		sizes = '100vw',
		ratio,
		fill = false,
		eager = false,
		alt,
		class: className,
	}: Props = $props();

	// Transformations need a zone: not in dev and not on *.workers.dev.
	const enabled = $derived(!dev && !page.url.hostname.endsWith('.workers.dev'));
	const fallback = $derived(widths[Math.floor(widths.length / 2)] ?? 960);
	const build = (w: number) =>
		media
			? imageUrl(
					media.url,
					{ width: w, height: ratio ? w / ratio : undefined, fit: ratio ? 'cover' : 'scale-down' },
					enabled,
				)
			: '';
	const srcset = $derived(enabled ? widths.map((w) => `${build(w)} ${w}w`).join(', ') : undefined);
</script>

{#if media}
	<img
		class={className}
		src={build(fallback)}
		{srcset}
		{sizes}
		alt={alt ?? media.alt ?? ''}
		width={media.width ?? undefined}
		height={media.height ?? undefined}
		loading={eager ? 'eager' : 'lazy'}
		decoding="async"
		style:aspect-ratio={fill ? undefined : ratio}
		style:width={ratio || fill ? '100%' : undefined}
		style:height={fill ? '100%' : undefined}
		style:object-fit={ratio || fill ? 'cover' : undefined}
	/>
{/if}
