<script lang="ts">
	import PageHead from '#lib/site/PageHead.svelte';
	import RoomsCompare from '#lib/site/pages/RoomsCompare.svelte';
	import RoomsOrchard from '#lib/site/pages/RoomsOrchard.svelte';
	import RoomsSalon from '#lib/site/pages/RoomsSalon.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const total = $derived(data.rooms.reduce((n, r) => n + (r.count ?? 0), 0));
</script>

<Seo title="Rooms" description="Twelve rooms in four kinds, in a mud-brick house with an apricot orchard in Changspa, Leh." siteName={data.site.siteName} />
<PageHead title="Rooms" lead={`${total || 12} rooms in ${data.rooms.length} kinds. Mud-brick walls, poplar beams, solar hot water and a heater for the cold mornings.`} />
<div class="container body">
	{#if data.design === 'b'}
		<RoomsOrchard rooms={data.rooms} filters />
	{:else if data.design === 'c'}
		<RoomsCompare rooms={data.rooms} />
	{:else}
		<RoomsSalon rooms={data.rooms} />
	{/if}
</div>

<style>
	.body {
		padding-top: var(--s-5);
	}
</style>
