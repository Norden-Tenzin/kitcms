<script lang="ts">
	// A: a two-column grid, small icon beside each title. B: a row of columns on a tint. C: rows,
	// title left and text right.
	import type { DesignId } from '../designs';
	import Icon from '../Icon.svelte';
	import { reveal } from '../reveal';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf } from '../types';

	let { block, design = 'a' }: { block: BlockOf<'features'>; design?: DesignId } = $props();
	const items = $derived(block.items ?? []);
</script>

<section class={['blk section', design === 'b' && 'surface']} data-design={design}>
	<div class="container">
		<SectionHead heading={block.heading} />
		<ul>
			{#each items as item, i (item.id ?? i)}
				<li class="reveal" use:reveal style:--i={i}>
					<h3>
						{#if item.icon && design === 'a'}<Icon name={item.icon} size={26} />{/if}
						<span>{item.title}</span>
					</h3>
					{#if item.text}<p class="muted">{item.text}</p>{/if}
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	ul {
		list-style: none;
		display: grid;
		gap: var(--s-5);
	}
	h3 {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: var(--s-2);
		font-size: clamp(1.5rem, 1.2rem + 1vw, 2rem);
	}
	h3 :global(svg) {
		flex: none;
		margin-top: 0.15em;
		color: var(--accent);
	}
	@media (min-width: 40rem) {
		[data-design='a'] ul {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-6) var(--s-7);
		}
		[data-design='b'] ul {
			grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
			gap: var(--s-5);
		}
	}
	@media (min-width: 56rem) {
		[data-design='c'] li {
			display: grid;
			grid-template-columns: 5fr 7fr;
			gap: var(--s-5);
			align-items: baseline;
			padding-block: var(--s-4);
		}
		[data-design='c'] ul {
			gap: 0;
		}
		[data-design='c'] li:nth-child(odd) {
			background: var(--surface);
			margin-inline: calc(var(--gutter) * -1);
			padding-inline: var(--gutter);
		}
		[data-design='c'] h3 {
			margin-bottom: 0;
		}
	}
</style>
