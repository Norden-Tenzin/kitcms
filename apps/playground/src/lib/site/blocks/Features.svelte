<script lang="ts">
	// Features: A a heading beside quiet rows. B a band on slate. C tiles on the surface tone.
	import Icon from '../Icon.svelte';
	import Section from '../Section.svelte';
	import { reveal } from '../reveal';
	import type { BlockProps } from './props';

	let { block, design = 'a' }: BlockProps<'features'> = $props();
	const items = $derived(block.items ?? []);
</script>

<Section tone={design === 'b' ? 'slate' : design === 'c' ? 'surface' : 'bg'} id={undefined}>
	<div class="wrap {design}">
		{#if block.title}<h2>{block.title}</h2>{/if}
		<ul>
			{#each items as item, i (item.id ?? i)}
				<li class="reveal" use:reveal style:--i={i % 4}>
					{#if item.icon}<Icon name={item.icon} size={design === 'b' ? 40 : 28} />{/if}
					<div>
						<strong>{item.label}</strong>
						{#if item.text}<p class="small">{item.text}</p>{/if}
					</div>
				</li>
			{/each}
		</ul>
	</div>
</Section>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-5);
	}
	li {
		display: flex;
		gap: var(--s-4);
		align-items: flex-start;
		line-height: 1.3;
	}
	li strong {
		font-size: 1.15em;
	}
	li p {
		margin-top: var(--s-1);
	}
	.wrap {
		display: grid;
		gap: var(--s-6);
	}
	/* B: icons stand on top of their label in a wide band. */
	.b li {
		flex-direction: column;
		gap: var(--s-3);
	}
	.b li :global(svg) {
		color: var(--apricot);
	}
	/* C: tiles */
	.c li {
		background: var(--bg);
		padding: var(--s-5);
		border-radius: var(--radius);
		align-items: center;
	}
	.c li :global(svg) {
		color: var(--accent);
		flex: none;
	}
	@media (min-width: 40rem) {
		.b ul,
		.c ul {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.a {
			grid-template-columns: 4fr 8fr;
			align-items: start;
		}
		.a ul {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--s-6) var(--s-6);
		}
		.b ul {
			grid-template-columns: repeat(4, 1fr);
		}
		.c ul {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
