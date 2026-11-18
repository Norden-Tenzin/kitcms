<script lang="ts">
	// Rooms, design A "Salon": alternating editorial rows, picture and text at uneven sizes.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import { asMedia } from '../media';
	import { inr, roomFacts, viewLabel } from '../format';
	import { reveal } from '../reveal';
	import type { Room } from '../types';

	let { rooms, limit }: { rooms: Room[]; limit?: number } = $props();
	const shown = $derived(limit ? rooms.slice(0, limit) : rooms);
</script>

<div class="rows">
	{#each shown as room, i (room.id)}
		<article class="row reveal" class:flip={i % 2 === 1} use:reveal>
			<Link href={`/rooms/${room.slug}`} class="pic-link" aria-hidden="true" tabindex={-1}>
				<Pic media={asMedia(room.cover)} ratio={i % 2 ? 4 / 5 : 3 / 2} sizes="(min-width: 56rem) 58vw, 100vw" />
			</Link>
			<div class="text">
				<p class="small">{viewLabel(room.view)} view{room.count ? `, ${room.count} rooms` : ''}</p>
				<h3><Link href={`/rooms/${room.slug}`}>{room.name}</Link></h3>
				{#if room.summary}<p class="sum">{room.summary}</p>{/if}
				<p class="facts small">{roomFacts(room).join(', ')}</p>
				<p class="price">{#if room.priceFrom}From <strong>{inr(room.priceFrom)}</strong> a night{/if}</p>
				<Link href={`/rooms/${room.slug}`} class="link">See the room</Link>
			</div>
		</article>
	{/each}
</div>

<style>
	.rows {
		display: grid;
		gap: var(--s-7);
	}
	.row {
		display: grid;
		gap: var(--s-5);
	}
	.row :global(.pic-link) {
		display: block;
	}
	.text {
		display: grid;
		gap: var(--s-3);
		align-content: start;
	}
	h3 :global(a) {
		text-decoration: none;
	}
	h3 :global(a:hover) {
		text-decoration: underline;
		text-decoration-thickness: 3px;
	}
	.sum {
		max-width: 44ch;
	}
	.price strong {
		font: 700 1.6rem/1 var(--font-display);
	}
	@media (min-width: 56rem) {
		.rows {
			gap: var(--section);
		}
		.row {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-6);
			align-items: start;
		}
		.row :global(.pic-link) {
			grid-column: 1 / 8;
		}
		.text {
			grid-column: 9 / 13;
			padding-top: var(--s-7);
		}
		.row:nth-child(even) .text {
			padding-top: var(--s-5);
		}
		.row.flip :global(.pic-link) {
			grid-column: 6 / 13;
			grid-row: 1;
		}
		.row.flip .text {
			grid-column: 1 / 5;
			grid-row: 1;
		}
	}
</style>
