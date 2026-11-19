<script lang="ts">
	import '../site.css';
	import Diagram from './Diagram.svelte';
	import { highlight } from '../highlight';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'howItWorks'> } = $props();
	// Safe for {@html}: `highlight` escapes every character of the (CMS) input.
	const headlessHtml = $derived(highlight(block.headless?.code, 'ts'));
</script>

<section class="section">
	<div class="container">
		<header>
			{#if block.title}<h2>{block.title}</h2>{/if}
			{#if block.intro}<p class="lead">{block.intro}</p>{/if}
		</header>
		<div class="modes">
			<article>
				<div class="art"><Diagram mode="fullApp" /></div>
				<h3>{block.fullApp?.title ?? ''}</h3>
				{#if block.fullApp?.text}<p class="muted">{block.fullApp.text}</p>{/if}
			</article>
			<article>
				<div class="art"><Diagram mode="headless" /></div>
				<h3>{block.headless?.title ?? ''}</h3>
				{#if block.headless?.text}<p class="muted">{block.headless.text}</p>{/if}
				{#if block.headless?.code}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<pre tabindex="0"><code class="language-ts">{@html headlessHtml}</code></pre>
				{/if}
			</article>
		</div>
	</div>
</section>

<style>
	header {
		margin-bottom: clamp(2rem, 1rem + 3vw, 3.5rem);
	}
	header :global(.lead) {
		max-width: 36rem;
	}
	.modes {
		display: grid;
		gap: 1.25rem;
	}
	article {
		min-width: 0;
		padding: clamp(1.25rem, 0.5rem + 2.5vw, 2.25rem);
		border-radius: 1rem;
		background: var(--surface);
	}
	.art {
		margin-bottom: 1.5rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		background: var(--bg);
	}
	pre {
		margin: 1.25rem 0 0;
		overflow-x: auto;
		padding: 1rem 1.25rem;
		border-radius: 0.75rem;
		background: var(--code-bg);
		color: var(--tok-punct);
		font-size: 0.8125rem;
		line-height: 1.65;
	}
	@media (min-width: 64rem) {
		.modes {
			grid-template-columns: 1fr 1fr;
			gap: 1.5rem;
		}
	}
</style>
