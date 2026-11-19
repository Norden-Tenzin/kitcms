<script lang="ts">
	import '../site.css';
	import Img from '../Img.svelte';
	import { asMedia } from '../media';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'codeShowcase'> } = $props();
	const image = $derived(asMedia(block.image));
	const language = $derived(block.language ?? 'ts');
</script>

<section class="section">
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		{#if block.text}<p class="lead intro">{block.text}</p>{/if}
		<div class="pair">
			<figure class="code">
				{#if block.filename}<figcaption class="filename">{block.filename}</figcaption>{/if}
				<pre><code class="language-{language}">{block.code ?? ''}</code></pre>
			</figure>
			<figure class="shot">
				{#if image}
					<Img media={image} widths={[640, 1000, 1400]} sizes="(min-width: 64rem) 40vw, 100vw" />
				{:else}
					<div class="placeholder" role="img" aria-label={block.caption || 'Admin screenshot'}></div>
				{/if}
				{#if block.caption}<figcaption class="muted">{block.caption}</figcaption>{/if}
			</figure>
		</div>
	</div>
</section>

<style>
	.intro {
		max-width: var(--measure);
	}
	.pair {
		display: grid;
		gap: 1.5rem;
		margin-top: 2rem;
	}
	figure {
		margin: 0;
		min-width: 0;
	}
	.filename {
		padding: 0.5rem 1rem;
		border: 1px solid var(--line);
		border-bottom: 0;
		border-radius: var(--radius) var(--radius) 0 0;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--muted);
	}
	pre {
		margin: 0;
		overflow-x: auto;
		padding: 1rem;
		border: 1px solid var(--line);
		border-radius: 0 0 var(--radius) var(--radius);
		background: var(--surface);
		font-size: 0.875rem;
		line-height: 1.55;
		tab-size: 2;
	}
	.shot :global(img) {
		width: 100%;
		height: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	.placeholder {
		aspect-ratio: 4 / 3;
		border: 1px dashed var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	figcaption.muted {
		margin-top: 0.5rem;
		font-size: 0.875rem;
	}
	@media (min-width: 64rem) {
		.pair {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
</style>
