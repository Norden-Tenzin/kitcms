<script lang="ts">
	// Rooms, design C "Compare": a comparison table. On a phone each row becomes a labelled block.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import { asMedia } from '../media';
	import { inr, viewLabel } from '../format';
	import type { Room } from '../types';

	let { rooms, limit }: { rooms: Room[]; limit?: number } = $props();
	const shown = $derived(limit ? rooms.slice(0, limit) : rooms);
</script>

<table>
	<caption class="sr-only">Room types compared</caption>
	<thead>
		<tr><th scope="col">Room</th><th scope="col">View</th><th scope="col">Sleeps</th><th scope="col">Size</th><th scope="col">Beds</th><th scope="col">Rooms</th><th scope="col">From, a night</th></tr>
	</thead>
	<tbody>
		{#each shown as room (room.id)}
			<tr>
				<th scope="row" class="name">
					<Link href={`/rooms/${room.slug}`}>
						<span class="thumb"><Pic media={asMedia(room.cover)} ratio={1} sizes="6rem" widths={[120, 240]} /></span>
						<span>{room.name}</span>
					</Link>
				</th>
				<td data-label="View">{viewLabel(room.view)}</td>
				<td data-label="Sleeps">{room.maxGuests ?? ''}</td>
				<td data-label="Size">{room.sizeSqm ? `${room.sizeSqm} m²` : ''}</td>
				<td data-label="Beds">{room.beds ?? ''}</td>
				<td data-label="Rooms">{room.count ?? ''}</td>
				<td data-label="From, a night" class="price">{inr(room.priceFrom)}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}
	thead {
		display: none;
	}
	tr {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-2) var(--s-4);
		padding: var(--s-5) 0;
	}
	tr:nth-child(odd) {
		background: var(--surface);
		margin-inline: calc(var(--gutter) * -1);
		padding-inline: var(--gutter);
	}
	.name {
		grid-column: 1 / -1;
		font: 700 clamp(1.6rem, 1.3rem + 1vw, 2.1rem) / 1.05 var(--font-display);
	}
	.name :global(a) {
		display: flex;
		align-items: center;
		gap: var(--s-4);
		text-decoration: none;
		min-height: 2.75rem;
	}
	.thumb {
		width: 4.5rem;
		flex: none;
	}
	td::before {
		content: attr(data-label);
		display: block;
		font-size: var(--step-small);
		color: var(--muted);
	}
	.price {
		font: 700 1.6rem/1.1 var(--font-display);
	}
	@media (min-width: 56rem) {
		thead {
			display: table-header-group;
		}
		thead th {
			padding: var(--s-3) var(--s-4);
			font-size: var(--step-small);
			color: var(--muted);
			font-weight: 600;
			background: var(--bg);
		}
		tr {
			display: table-row;
		}
		tr:nth-child(odd) {
			margin: 0;
			padding: 0;
		}
		tr:nth-child(odd) > * {
			background: var(--surface);
		}
		th,
		td {
			padding: var(--s-4);
			vertical-align: middle;
		}
		td::before {
			display: none;
		}
		.name {
			font-size: 1.9rem;
		}
		.thumb {
			width: 6rem;
		}
	}
</style>
