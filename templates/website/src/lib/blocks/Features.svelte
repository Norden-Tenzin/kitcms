<script lang="ts">
	import '../site.css';
	import type { DesignId } from '../designs';
	import { ICON_PATHS } from '../icons';
	import type { BlockOf } from './types';

	// A "Editorial": the title beside a plain list. B "Immersive": rounded cards with a round icon.
	// C "Structured": a grid of square tiles.
	let { block, design = 'a' }: { block: BlockOf<'features'>; design?: DesignId } = $props();
</script>

<section class="section" data-design={design}>
	<div class="container wrap">
		{#if block.title}<h2>{block.title}</h2>{/if}
		<ul class="items">
			{#each block.items ?? [] as item (item.id)}
				<li>
					{#if item.icon}
						<span class="icon">
							<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
								<path d={ICON_PATHS[item.icon]} />
							</svg>
						</span>
					{/if}
					<div>
						<h3>{item.title ?? ''}</h3>
						{#if item.text}<p class="text">{item.text}</p>{/if}
					</div>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.section[data-design='a'] {
		--font-display: var(--font-serif);
	}
	.section[data-design='a'] h2 {
		font-weight: 600;
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-4);
	}
	li {
		display: flex;
		gap: var(--s-3);
	}
	h3 {
		margin: 0 0 0.25em;
	}
	.text {
		margin: 0;
		color: var(--muted);
	}
	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
		flex: none;
	}
	.icon {
		color: var(--accent);
		line-height: 0;
		padding-top: 0.15rem;
	}

	/* B: cards */
	.section[data-design='b'] h2 {
		text-align: center;
		margin-bottom: var(--s-5);
	}
	.section[data-design='b'] .items {
		gap: var(--s-3);
	}
	.section[data-design='b'] li {
		flex-direction: column;
		padding: var(--s-4);
		background: var(--surface);
		border-radius: calc(var(--radius) * 2);
	}
	.section[data-design='b'] .icon {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		padding: 0;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-ink);
	}

	/* C: tiles */
	.section[data-design='c'] h2 {
		margin-bottom: var(--s-4);
	}
	.section[data-design='c'] .items {
		gap: 0.5rem;
	}
	.section[data-design='c'] li {
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-4);
		min-height: 11rem;
		background: var(--surface);
		border-radius: 0.25rem;
	}
	.section[data-design='c'] .icon {
		order: 2;
		margin-top: auto;
	}
	.section[data-design='c'] li > div {
		order: 1;
	}

	@media (min-width: 40rem) {
		.section[data-design='b'] .items,
		.section[data-design='c'] .items {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.section[data-design='a'] .wrap {
			display: grid;
			grid-template-columns: 4fr 8fr;
			gap: var(--s-6);
			align-items: start;
		}
		.section[data-design='a'] h2 {
			position: sticky;
			top: calc(var(--header-h) + var(--s-3));
		}
		.section[data-design='a'] .items {
			gap: var(--s-5);
		}
		.section[data-design='b'] .items,
		.section[data-design='c'] .items {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
