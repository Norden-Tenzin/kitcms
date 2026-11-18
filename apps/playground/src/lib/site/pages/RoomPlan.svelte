<script lang="ts">
	// Room, design C "Plan": a datasheet. Pictures and text on the left, a sticky panel with the
	// facts and the enquiry on the right.
	import Amenities from '../Amenities.svelte';
	import RoomEnquiry from '../RoomEnquiry.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { asMedia, asMediaList } from '../media';
	import { inr, viewLabel } from '../format';
	import type { Shell } from '../shell';
	import type { Room } from '../types';
	import RoomsCompare from './RoomsCompare.svelte';

	let { room, others, shell }: { room: Room; others: Room[]; shell: Shell } = $props();
	const gallery = $derived(asMediaList(room.gallery));
	const facts = $derived(
		[
			['View', viewLabel(room.view)],
			['Size', room.sizeSqm ? `${room.sizeSqm} m²` : ''],
			['Sleeps', room.maxGuests ? String(room.maxGuests) : ''],
			['Beds', room.beds ?? ''],
			['Rooms of this type', room.count ? String(room.count) : ''],
			['Check-in', shell.checkIn],
			['Check-out', shell.checkOut],
		].filter(([, v]) => v),
	);
</script>

<article>
	<Section tone="surface" pad="bottom">
		<div class="pt-hdr head">
			<h1>{room.name}</h1>
			{#if room.summary}<p class="lead">{room.summary}</p>{/if}
		</div>
	</Section>
	<Section>
		<div class="cols">
			<div class="main">
				<Pic media={asMedia(room.cover)} ratio={3 / 2} eager widths={[700, 1100, 1600]} sizes="(min-width: 64rem) 60vw, 100vw" alt="" />
				<RichText doc={room.description} />
				<h2>Amenities</h2>
				<Amenities items={room.amenities ?? []} />
				{#if gallery.length}
					<div class="grid">
						{#each gallery as m (m.id)}<Pic media={m} ratio={4 / 3} sizes="(min-width: 64rem) 30vw, 50vw" />{/each}
					</div>
				{/if}
			</div>
			<aside class="panel">
				<p class="price">{#if room.priceFrom}{inr(room.priceFrom)}<small> from, a night</small>{/if}</p>
				<dl>
					{#each facts as [k, v] (k)}<div><dt>{k}</dt><dd>{v}</dd></div>{/each}
				</dl>
				<RoomEnquiry {shell} {room} />
			</aside>
		</div>
	</Section>
	{#if others.length}
		<Section>
			<h2 class="h2">All room types</h2>
			<RoomsCompare rooms={[room, ...others]} />
		</Section>
	{/if}
</article>

<style>
	.head {
		display: grid;
		gap: var(--s-4);
	}
	.head h1 {
		font-size: clamp(3rem, 1rem + 8vw, 7rem);
	}
	.cols {
		display: grid;
		gap: var(--s-7);
	}
	.main {
		display: grid;
		gap: var(--s-5);
		align-content: start;
	}
	.main h2,
	.h2 {
		font-size: clamp(1.8rem, 1.4rem + 1.4vw, 2.6rem);
	}
	.h2 {
		margin-bottom: var(--s-6);
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-3);
	}
	.panel {
		display: grid;
		gap: var(--s-5);
		align-content: start;
		background: var(--surface);
		padding: var(--s-5);
		border-radius: var(--radius);
	}
	.price {
		font: 700 clamp(2.6rem, 2rem + 2vw, 3.6rem) / 1 var(--font-display);
	}
	.price small {
		font: 400 1rem var(--font-text);
		color: var(--muted);
	}
	dl {
		margin: 0;
		display: grid;
	}
	dl div {
		display: flex;
		justify-content: space-between;
		gap: var(--s-4);
		padding-block: var(--s-2);
	}
	dl div:nth-child(odd) {
		background: var(--bg);
		margin-inline: calc(var(--s-3) * -1);
		padding-inline: var(--s-3);
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-weight: 600;
		text-align: right;
	}
	@media (min-width: 64rem) {
		.cols {
			grid-template-columns: 8fr 4fr;
			align-items: start;
			gap: var(--s-7);
		}
		.panel {
			position: sticky;
			top: calc(var(--header-h) + var(--s-5));
		}
	}
</style>
