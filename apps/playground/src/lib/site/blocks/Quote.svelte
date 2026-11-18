<script lang="ts">
	// A: the quote left, a picture right. B: the quote on a full-bleed photograph. C: the quote on an accent field.
	import type { DesignId } from '../designs';
	import Img from '../Img.svelte';
	import { asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import type { BlockOf } from '../types';

	let { block, design = 'a' }: { block: BlockOf<'quote'>; design?: DesignId } = $props();
	const image = $derived(asMedia(block.image));
	const onPhoto = $derived(design === 'b' && Boolean(image));
</script>

<section class={['blk section', onPhoto && 'photo', design === 'b' && !image && 'inverse', design === 'c' && 'accent-field']} data-design={design}>
	{#if onPhoto}<div class="bg"><Img media={image} fit="cover" widths={[800, 1400, 1600]} alt="" /></div>{/if}
	<div class="container grid">
		<figure class="reveal" use:reveal>
			<blockquote>
				<p>{block.text ?? ''}</p>
			</blockquote>
			{#if block.attribution}<figcaption>{block.attribution}</figcaption>{/if}
		</figure>
		{#if image && design === 'a'}
			<div class="pic"><Pic media={image} ratio={4 / 5} widths={[480, 800]} sizes="(min-width: 56rem) 30vw, 70vw" /></div>
		{/if}
	</div>
</section>

<style>
	.blk {
		position: relative;
	}
	.grid {
		position: relative;
		display: grid;
		gap: var(--s-5);
	}
	figure {
		margin: 0;
	}
	blockquote {
		margin: 0;
		max-width: 26ch;
	}
	blockquote p {
		font: clamp(1.8rem, 1.1rem + 2.4vw, 2.25rem) / 1.2 var(--font-display);
		text-wrap: balance;
	}
	figcaption {
		margin-top: var(--s-3);
		color: var(--muted);
	}
	.photo {
		color: #fff;
		background: #26282a;
		--muted: rgb(255 255 255 / 0.85);
		--focus: #fff;
	}
	.bg {
		position: absolute;
		inset: 0;
	}
	.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: rgb(0 0 0 / 0.5);
	}
	.photo .grid {
		z-index: 1;
	}
	[data-design='b'] .grid {
		padding-block: var(--s-6);
	}
	@media (min-width: 56rem) {
		[data-design='a'] .grid {
			grid-template-columns: 7fr 3fr;
			align-items: end;
			gap: var(--s-7);
		}
		blockquote p {
			font-size: 2.25rem;
		}
	}
</style>
