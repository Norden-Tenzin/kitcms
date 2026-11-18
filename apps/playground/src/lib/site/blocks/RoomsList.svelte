<script lang="ts">
	// Featured rooms: the same three room layouts as the /rooms page, so a design reads alike everywhere.
	import RoomsCompare from '../pages/RoomsCompare.svelte';
	import RoomsOrchard from '../pages/RoomsOrchard.svelte';
	import RoomsSalon from '../pages/RoomsSalon.svelte';
	import Link from '../Link.svelte';
	import Section from '../Section.svelte';
	import type { BlockProps } from './props';

	let { block, design = 'a', extras }: BlockProps<'roomsList'> = $props();
	const rooms = $derived((extras?.rooms ?? []).filter((r) => !block.onlyFeatured || r.featured));
</script>

<Section tone={design === 'c' ? 'bg' : 'bg'}>
	<div class="head">
		{#if block.heading}<h2>{block.heading}</h2>{/if}
		{#if block.intro}<p class="lead">{block.intro}</p>{/if}
	</div>
	{#if design === 'b'}
		<RoomsOrchard {rooms} limit={3} />
	{:else if design === 'c'}
		<RoomsCompare {rooms} />
	{:else}
		<RoomsSalon {rooms} limit={2} />
	{/if}
	<p class="more"><Link href="/rooms" class="link">All room types</Link></p>
</Section>

<style>
	.head {
		display: grid;
		gap: var(--s-4);
		margin-bottom: var(--s-7);
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
