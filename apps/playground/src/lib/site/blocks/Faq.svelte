<script lang="ts">
	// Questions as native <details>: they work without script. A: heading left, questions right.
	// B: questions stacked full width on tinted rows. C: two columns of questions.
	import type { DesignId } from '../designs';
	import Icon from '../Icon.svelte';
	import { reveal } from '../reveal';
	import type { BlockOf } from '../types';

	let { block, design = 'a' }: { block: BlockOf<'faq'>; design?: DesignId } = $props();
	const items = $derived(block.items ?? []);
</script>

{#if items.length}
	<section class="blk section" data-design={design}>
		<div class="container grid">
			{#if block.heading}<h2 class="reveal" use:reveal>{block.heading}</h2>{/if}
			<div class="list">
				{#each items as item, i (item.id ?? i)}
					<details class="reveal" use:reveal style:--i={i % 3}>
						<summary>
							<span>{item.question}</span>
							<span class="icon"><Icon name="plus" size={22} /></span>
						</summary>
						<p>{item.answer}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>
{/if}

<style>
	.grid {
		display: grid;
		gap: var(--s-5);
	}
	h2 {
		max-width: 12ch;
	}
	.list {
		display: grid;
		gap: var(--s-2);
		align-content: start;
	}
	details {
		background: var(--surface);
	}
	[data-design='b'] details {
		background: var(--surface-2);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		min-height: 3.5rem;
		padding: 0.75rem 1.1rem;
		font: 600 var(--step-0) / 1.35 var(--font-text);
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		background: color-mix(in srgb, var(--ink) 4%, transparent);
	}
	.icon {
		flex: none;
		transition: rotate 0.25s var(--ease);
	}
	details[open] .icon {
		rotate: 45deg;
	}
	details p {
		padding: 0 1.1rem 1.25rem;
		max-width: 44rem;
		color: var(--muted);
	}
	@media (min-width: 56rem) {
		[data-design='a'] .grid {
			grid-template-columns: 4fr 8fr;
			gap: var(--s-7);
		}
		[data-design='c'] .list {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-3);
			align-items: start;
		}
	}
</style>
