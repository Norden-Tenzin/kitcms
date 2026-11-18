<script lang="ts">
	// Client quotes from the `testimonials` collection. A: the first quote large, the rest beside it.
	// B: three columns on a tint. C: one column, quote right of the name.
	import type { DesignId } from '../designs';
	import { reveal } from '../reveal';
	import Placeholder from './Placeholder.svelte';
	import SectionHead from './SectionHead.svelte';
	import type { BlockOf, Testimonial } from '../types';

	let { block, testimonials, design = 'a' }: { block: BlockOf<'testimonials'>; testimonials?: Testimonial[]; design?: DesignId } = $props();
	const shown = $derived((testimonials ?? []).slice(0, block.count ?? 3));
</script>

{#if !testimonials}
	<Placeholder title={block.heading || 'Testimonials'} text="Shows quotes from the Testimonials collection." />
{:else if shown.length}
	<section class={['blk section', design === 'b' && 'surface']} data-design={design}>
		<div class="container">
			<SectionHead heading={block.heading} />
			<ul>
				{#each shown as t, i (t.id)}
					<li class={['reveal', i === 0 && 'first']} use:reveal style:--i={i}>
						<blockquote><p>{t.quote}</p></blockquote>
						<p class="who">
							<strong>{t.name}</strong>
							<span class="muted">{[t.role, t.company].filter(Boolean).join(', ')}</span>
						</p>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	ul {
		list-style: none;
		display: grid;
		gap: var(--s-5);
	}
	blockquote {
		margin: 0 0 var(--s-3);
	}
	blockquote p {
		font: clamp(1.4rem, 1.1rem + 1vw, 1.75rem) / 1.3 var(--font-display);
		text-wrap: pretty;
	}
	.first blockquote p {
		font-size: clamp(1.9rem, 1.1rem + 2.6vw, 2.5rem);
		line-height: 1.15;
	}
	.who {
		display: grid;
		font-size: var(--step-small);
	}
	[data-design='b'] li {
		background: var(--surface-2);
		padding: var(--s-4);
	}
	@media (min-width: 56rem) {
		[data-design='a'] ul {
			grid-template-columns: 7fr 5fr;
			gap: var(--s-5) var(--s-7);
		}
		[data-design='a'] .first {
			grid-row: span 2;
		}
		[data-design='b'] ul {
			grid-template-columns: repeat(3, 1fr);
			gap: var(--s-3);
		}
		[data-design='b'] .first blockquote p {
			font-size: clamp(1.4rem, 1.1rem + 1vw, 1.75rem);
			line-height: 1.3;
		}
		[data-design='c'] li {
			display: grid;
			grid-template-columns: 4fr 8fr;
			gap: var(--s-5);
		}
		[data-design='c'] .who {
			order: -1;
		}
		[data-design='c'] .first blockquote p {
			font-size: clamp(1.4rem, 1.1rem + 1vw, 1.75rem);
			line-height: 1.3;
		}
		[data-design='c'] blockquote {
			margin: 0;
		}
	}
</style>
