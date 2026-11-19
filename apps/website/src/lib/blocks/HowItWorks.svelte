<script lang="ts">
	import '../site.css';
	import Diagram from './Diagram.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'howItWorks'> } = $props();
</script>

<section class="section">
	<div class="container">
		{#if block.title}<h2>{block.title}</h2>{/if}
		{#if block.intro}<p class="lead intro">{block.intro}</p>{/if}
		<div class="modes">
			<article>
				<Diagram mode="fullApp" />
				<h3>{block.fullApp?.title ?? ''}</h3>
				{#if block.fullApp?.text}<p class="muted">{block.fullApp.text}</p>{/if}
			</article>
			<article>
				<Diagram mode="headless" />
				<h3>{block.headless?.title ?? ''}</h3>
				{#if block.headless?.text}<p class="muted">{block.headless.text}</p>{/if}
				{#if block.headless?.code}
					<pre><code class="language-ts">{block.headless.code}</code></pre>
				{/if}
			</article>
		</div>
	</div>
</section>

<style>
	.intro {
		max-width: var(--measure);
	}
	.modes {
		display: grid;
		gap: 2rem;
		margin-top: 2rem;
	}
	article {
		min-width: 0;
		padding: 1.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	pre {
		margin: 0;
		overflow-x: auto;
		padding: 1rem;
		border-radius: var(--radius);
		background: var(--surface);
		font-size: 0.8125rem;
		line-height: 1.55;
	}
	@media (min-width: 64rem) {
		.modes {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
