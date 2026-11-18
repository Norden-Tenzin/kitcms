<script lang="ts">
	// Room, design B "Window": the picture is the first screen, facts sit on it, text and amenities
	// follow on an earth field, then the pictures large.
	import Amenities from '../Amenities.svelte';
	import RoomEnquiry from '../RoomEnquiry.svelte';
	import Img from '../Img.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { asMedia, asMediaList } from '../media';
	import { inr, roomFacts, viewLabel } from '../format';
	import type { Shell } from '../shell';
	import type { Room } from '../types';
	import RoomsSalon from './RoomsSalon.svelte';

	let { room, others, shell }: { room: Room; others: Room[]; shell: Shell } = $props();
	const gallery = $derived(asMediaList(room.gallery));
</script>

<article>
	<header class="hero on-dark">
		<div class="photo"><Img media={asMedia(room.cover)} eager fit="cover" widths={[800, 1400, 2000]} sizes="100vw" alt="" /></div>
		<div class="container inner">
			<h1>{room.name}</h1>
			<p>{viewLabel(room.view)} view</p>
			<ul class="chips">
				{#each roomFacts(room) as f (f)}<li>{f}</li>{/each}
				{#if room.priceFrom}<li class="price">From {inr(room.priceFrom)}</li>{/if}
			</ul>
		</div>
	</header>

	<Section tone="earth">
		<div class="cols">
			<div>
				{#if room.summary}<p class="lead">{room.summary}</p>{/if}
				<RichText doc={room.description} />
			</div>
			<div class="am"><h2>In the room</h2><Amenities items={room.amenities ?? []} columns={1} /></div>
		</div>
	</Section>

	{#if gallery.length}
		<Section bleed pad="none">
			<div class="pics">
				{#each gallery as m, i (m.id)}
					<Pic media={m} ratio={i % 3 === 0 ? 16 / 9 : 4 / 3} widths={[600, 1100, 1800]} sizes="(min-width: 56rem) 50vw, 100vw" class={i % 3 === 0 ? 'full' : ''} />
				{/each}
			</div>
		</Section>
	{/if}

	<Section>
		<div class="ask"><h2>Stay in the {room.name}</h2><RoomEnquiry {shell} {room} title={false} /></div>
	</Section>

	{#if others.length}
		<Section>
			<h2 class="h2">Other rooms</h2>
			<RoomsSalon rooms={others.slice(0, 2)} />
		</Section>
	{/if}
</article>

<style>
	.hero {
		position: relative;
		min-height: 100svh;
		display: grid;
		align-items: end;
		color: #fff;
		isolation: isolate;
	}
	.photo {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--slate);
	}
	.photo::after {
		content: '';
		position: absolute;
		inset: 40% 0 0;
		background: linear-gradient(transparent, rgb(20 12 8 / 0.78)); /* neutral scrim under text on a photograph, taste-skill-ignore */
	}
	.inner {
		padding-block: var(--s-7) var(--s-6);
		display: grid;
		gap: var(--s-4);
	}
	.hero h1 {
		font-size: clamp(3.4rem, 0.8rem + 12vw, 11rem);
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2) var(--s-5);
		font-size: var(--step-lead);
	}
	.price {
		font-weight: 600;
		color: var(--apricot);
	}
	.cols {
		display: grid;
		gap: var(--s-6);
	}
	.cols .lead {
		margin-bottom: var(--s-4);
		max-width: 30ch;
	}
	.am :global(svg) {
		color: var(--apricot);
	}
	.am {
		display: grid;
		gap: var(--s-4);
		align-content: start;
	}
	.pics {
		display: grid;
		gap: var(--s-1);
	}
	.pics :global(.pic) {
		border-radius: 0;
	}
	.ask {
		display: grid;
		gap: var(--s-5);
		max-width: 40rem;
	}
	.h2 {
		margin-bottom: var(--s-6);
	}
	@media (min-width: 56rem) {
		.cols {
			grid-template-columns: 7fr 4fr;
			gap: var(--s-8, 6rem);
		}
		.pics {
			grid-template-columns: 1fr 1fr;
		}
		.pics :global(.full) {
			grid-column: 1 / -1;
		}
	}
</style>
