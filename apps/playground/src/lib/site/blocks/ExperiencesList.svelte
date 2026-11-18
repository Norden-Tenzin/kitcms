<script lang="ts">
	import ExperienceCards from '../pages/ExperienceCards.svelte';
	import Link from '../Link.svelte';
	import Section from '../Section.svelte';
	import type { BlockProps } from './props';

	let { block, design = 'a', extras }: BlockProps<'experiencesList'> = $props();
</script>

<Section>
	<div class="head">
		{#if block.heading}<h2>{block.heading}</h2>{/if}
		{#if block.intro}<p class="lead">{block.intro}</p>{/if}
	</div>
	<ExperienceCards items={extras?.experiences ?? []} {design} limit={block.count ?? 3} />
	<p class="more"><Link href="/experiences" class="link">All experiences</Link></p>
</Section>

<style>
	.head {
		display: grid;
		gap: var(--s-4);
		margin-bottom: var(--s-6);
	}
	.more {
		margin-top: var(--s-6);
	}
	@media (min-width: 56rem) {
		.head {
			grid-template-columns: 7fr 5fr;
			align-items: end;
		}
	}
</style>
