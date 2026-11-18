<script lang="ts">
	// Room, design A "Threshold": editorial. Big name, a wide picture, text beside the facts, a
	// scrolling strip of the room's pictures.
	import Amenities from '../Amenities.svelte';
	import RoomEnquiry from '../RoomEnquiry.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { asMedia, asMediaList } from '../media';
	import { inr, roomFacts, viewLabel } from '../format';
	import type { Shell } from '../shell';
	import type { Room } from '../types';
	import RoomsOrchard from './RoomsOrchard.svelte';

	let { room, others, shell }: { room: Room; others: Room[]; shell: Shell } = $props();
	const gallery = $derived(asMediaList(room.gallery));
</script>

<article>
	<header class="container head pt-hdr">
		<h1>{room.name}</h1>
		<p class="small">{viewLabel(room.view)} view</p>
		{#if room.summary}<p class="lead">{room.summary}</p>{/if}
	</header>
	<div class="container"><Pic media={asMedia(room.cover)} ratio={16 / 8} eager widths={[800, 1400, 2000]} sizes="(min-width: 82rem) 78rem, 100vw" alt="" /></div>

	<Section>
		<div class="cols">
			<div class="text">
				<RichText doc={room.description} />
				<h2 class="h2">What is in the room</h2>
				<Amenities items={room.amenities ?? []} />
			</div>
			<aside class="side">
				<p class="price">{#if room.priceFrom}<span>From</span> {inr(room.priceFrom)}<small> a night, with breakfast</small>{/if}</p>
				<ul class="facts">
					{#each roomFacts(room) as f (f)}<li>{f}</li>{/each}
					{#if room.count}<li>{room.count} rooms of this type</li>{/if}
					{#if shell.checkIn}<li>Check-in {shell.checkIn}, check-out {shell.checkOut}</li>{/if}
				</ul>
				<RoomEnquiry {shell} {room} />
			</aside>
		</div>
	</Section>

	{#if gallery.length}
		<Section bleed pad="top">
			<ul class="strip">
				{#each gallery as m (m.id)}
					<li><Pic media={m} fill widths={[500, 900, 1400]} sizes="(min-width: 56rem) 38vw, 80vw" /></li>
				{/each}
			</ul>
		</Section>
	{/if}

	{#if others.length}
		<Section>
			<h2 class="h2">The other rooms</h2>
			<RoomsOrchard rooms={others} limit={3} />
		</Section>
	{/if}
</article>

<style>
	.head {
		display: grid;
		gap: var(--s-4);
		padding-bottom: var(--s-6);
	}
	.head h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	.cols {
		display: grid;
		gap: var(--s-7);
	}
	.text {
		display: grid;
		gap: var(--s-5);
		align-content: start;
	}
	.h2 {
		font-size: clamp(1.8rem, 1.4rem + 1.4vw, 2.6rem);
		margin-top: var(--s-4);
	}
	.side {
		display: grid;
		gap: var(--s-5);
		align-content: start;
	}
	.price {
		font: 700 clamp(2.4rem, 1.8rem + 2vw, 3.4rem) / 1 var(--font-display);
	}
	.price span,
	.price small {
		font: 400 1rem var(--font-text);
		color: var(--muted);
	}
	.facts {
		display: grid;
		gap: var(--s-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.strip {
		list-style: none;
		margin: 0;
		padding: 0 var(--gutter);
		display: flex;
		gap: var(--s-3);
		height: 56svh;
		min-height: 18rem;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
	}
	.strip li {
		flex: none;
		width: 78vw;
		scroll-snap-align: start;
	}
	@media (min-width: 56rem) {
		.cols {
			grid-template-columns: 7fr 4fr;
			gap: var(--s-8, 6rem);
		}
		.side {
			position: sticky;
			top: calc(var(--header-h) + var(--s-5));
		}
		.strip li {
			width: 38vw;
		}
	}
</style>
