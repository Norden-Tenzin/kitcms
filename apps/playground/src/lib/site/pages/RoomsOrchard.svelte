<script lang="ts">
	// Rooms, design B "Orchard": a card grid. With `filters`, a progressive client-side filter by
	// view and guests (all rooms show without script).
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import { asMedia } from '../media';
	import { inr, roomFacts, viewLabel, VIEW_LABELS } from '../format';
	import { reveal } from '../reveal';
	import type { Room } from '../types';

	let { rooms, filters = false, limit }: { rooms: Room[]; filters?: boolean; limit?: number } = $props();
	let view = $state('all');
	let guests = $state(1);
	const views = $derived([...new Set(rooms.map((r) => r.view).filter((v): v is NonNullable<typeof v> => Boolean(v)))]);
	const base = $derived(limit ? rooms.slice(0, limit) : rooms);
	const shown = $derived(base.filter((r) => (view === 'all' || r.view === view) && (r.maxGuests ?? 99) >= guests));
</script>

{#if filters}
	<div class="filters" role="group" aria-label="Filter rooms">
		<div class="seg" role="group" aria-label="View">
			<button type="button" aria-pressed={view === 'all'} onclick={() => (view = 'all')}>All views</button>
			{#each views as v (v)}
				<button type="button" aria-pressed={view === v} onclick={() => (view = v)}>{VIEW_LABELS[v] ?? v}</button>
			{/each}
		</div>
		<label>
			<span>Guests</span>
			<select bind:value={guests}>
				{#each [1, 2, 3, 4] as n (n)}<option value={n}>{n}{n === 4 ? ' or more' : ''}</option>{/each}
			</select>
		</label>
		<p class="small" role="status">{shown.length} of {base.length} room types</p>
	</div>
{/if}

<ul class="grid">
	{#each shown as room, i (room.id)}
		<li class="card reveal" use:reveal style:--i={i % 3}>
			<Link href={`/rooms/${room.slug}`} class="media" aria-hidden="true" tabindex={-1}>
				<Pic media={asMedia(room.cover)} ratio={4 / 3} sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 100vw" />
			</Link>
			<div class="body">
				<h3><Link href={`/rooms/${room.slug}`}>{room.name}</Link></h3>
				<p class="small">{viewLabel(room.view)} view</p>
				{#if room.summary}<p class="sum">{room.summary}</p>{/if}
				<p class="facts small">{roomFacts(room).join(', ')}</p>
				<p class="foot">
					{#if room.priceFrom}<span class="price">{inr(room.priceFrom)}<small> a night</small></span>{/if}
					<Link href={`/rooms/${room.slug}`} class="link">Details</Link>
				</p>
			</div>
		</li>
	{:else}
		<li class="empty">No room matches. Try another view or fewer guests.</li>
	{/each}
</ul>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--s-4) var(--s-6);
		margin-bottom: var(--s-6);
	}
	.seg {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.seg button {
		min-height: 2.75rem;
		padding: 0 1.1rem;
		border: 2px solid var(--ink);
		border-radius: var(--radius);
		background: transparent;
		color: var(--ink);
		font: 600 1rem var(--font-text);
		cursor: pointer;
		transition: background-color 0.2s var(--ease), color 0.2s var(--ease);
	}
	.seg button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--bg);
	}
	label {
		display: grid;
		gap: var(--s-1);
		font-weight: 600;
	}
	select {
		min-height: 2.75rem;
		min-width: 8rem;
		padding: 0 0.75rem;
		border: 2px solid var(--ink);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--ink);
		font: 500 1rem var(--font-text);
	}
	.filters p {
		margin-left: auto;
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-6) var(--s-5);
		grid-template-columns: 1fr;
	}
	.card {
		display: grid;
		gap: var(--s-4);
		align-content: start;
	}
	.card :global(.media) {
		display: block;
		overflow: hidden;
		border-radius: var(--radius);
	}
	.card :global(.media .pic) {
		transition: transform 0.5s var(--ease);
	}
	.card:hover :global(.media .pic) {
		transform: scale(1.04);
	}
	.body {
		display: grid;
		gap: var(--s-2);
	}
	h3 :global(a) {
		text-decoration: none;
	}
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: var(--s-2);
	}
	.price {
		font: 700 1.7rem/1 var(--font-display);
	}
	.price small {
		font: 400 0.9rem var(--font-text);
		color: var(--muted);
	}
	.empty {
		grid-column: 1 / -1;
		padding: var(--s-6) 0;
	}
	@media (min-width: 40rem) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
