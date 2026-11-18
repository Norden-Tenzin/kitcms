<script lang="ts">
	// Dining, design C "Table": structured. A fixed photograph beside a scrolling column of tables, one
	// per course, on surface panels. The one live thing: filter the whole menu (Vegetarian, Ladakhi).
	import { onMount } from 'svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import { asMedia } from '../media';
	import type { BlockOf, Dish, PageBlock } from '../types';
	import { byCourse, COURSE_NOTE, pick } from './pagedata';

	let { dishes, blocks, lead }: { dishes: Dish[]; blocks: PageBlock[]; lead?: string } = $props();
	const intro = $derived(pick(blocks, 'split') as BlockOf<'split'> | undefined);
	let filter = $state<'all' | 'vegetarian' | 'ladakhi'>('all');
	// The chips need script, so they only exist once it runs (the full menu shows without it).
	let ready = $state(false);
	onMount(() => (ready = true));
	const shown = $derived(
		dishes.filter((d) => filter === 'all' || (filter === 'vegetarian' ? d.vegetarian : d.ladakhi)),
	);
	const groups = $derived(byCourse(shown));
	const FILTERS = [
		['all', 'Everything'],
		['vegetarian', 'Vegetarian'],
		['ladakhi', 'Ladakhi'],
	] as const;
</script>

<div class="container cols pt-hdr">
	<aside class="photo">
		<Pic media={asMedia(intro?.image)} ratio={4 / 5} eager widths={[500, 800, 1100]} sizes="(min-width: 56rem) 36vw, 100vw" />
	</aside>
	<div class="main">
		<header>
			<h1>Dining</h1>
			{#if lead}<p class="lead">{lead}</p>{/if}
			<RichText doc={intro?.text} />
		</header>

		{#if ready}
			<div class="chips" role="group" aria-label="Filter the menu">
				{#each FILTERS as [id, label] (id)}
					<button type="button" class="chip" aria-pressed={filter === id} onclick={() => (filter = id)}>{label}</button>
				{/each}
			</div>
		{/if}

		<div class="panels" aria-live="polite">
			{#each groups as g (g.course)}
				<section class="panel">
					<table>
						<caption>
							<span class="cap">{g.course}</span>
							<span class="small">{COURSE_NOTE[g.course]}</span>
						</caption>
						<thead>
							<tr><th scope="col">Dish</th><th scope="col">Ladakhi</th><th scope="col">Vegetarian</th></tr>
						</thead>
						<tbody>
							{#each g.dishes as d (d.id)}
								<tr>
									<th scope="row"><strong>{d.name}</strong>{#if d.description}<span class="small">{d.description}</span>{/if}</th>
									<td class:no={!d.ladakhi} data-label="Ladakhi">{d.ladakhi ? 'Yes' : ''}</td>
									<td class:no={!d.vegetarian} data-label="Vegetarian">{d.vegetarian ? 'Yes' : ''}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{:else}
				<p>Nothing on the menu matches. Try another filter.</p>
			{/each}
		</div>
	</div>
</div>

<style>
	.cols {
		display: grid;
		gap: var(--s-6);
		padding-bottom: var(--s-7);
	}
	.photo {
		align-self: start;
	}
	header {
		display: grid;
		gap: var(--s-4);
		margin-bottom: var(--s-5);
	}
	.main {
		min-width: 0;
		display: grid;
		gap: var(--s-5);
		align-content: start;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.chip {
		min-height: 2.75rem;
		padding: 0.4rem 1.1rem;
		border: 0;
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--ink);
		font: 600 1rem/1 var(--font-text);
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		background: var(--ink);
		color: var(--bg);
	}
	.panels {
		display: grid;
		gap: var(--s-4);
	}
	.panel {
		background: var(--surface);
		border-radius: var(--radius);
		padding: var(--s-5);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	caption {
		text-align: left;
		padding-bottom: var(--s-3);
	}
	caption span {
		display: block;
	}
	.cap {
		font: 700 clamp(2rem, 1.4rem + 2vw, 2.8rem) / 1 var(--font-display);
		text-transform: capitalize;
	}
	thead {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	tbody tr {
		display: block;
		padding-block: var(--s-3);
		border-top: 2px solid var(--bg);
	}
	th[scope='row'] {
		display: grid;
		gap: 0.2rem;
		text-align: left;
		font-weight: 400;
	}
	th strong {
		font-weight: 600;
		font-size: 1.125rem;
	}
	td {
		display: inline-block;
		margin: var(--s-2) var(--s-4) 0 0;
		font-size: var(--step-small);
		font-weight: 600;
	}
	td::before {
		content: attr(data-label) ': ';
		font-weight: 400;
	}
	td.no {
		display: none;
	}
	@media (min-width: 56rem) {
		.cols {
			grid-template-columns: 5fr 7fr;
			gap: var(--s-7);
			align-items: start;
		}
		.photo {
			position: sticky;
			top: calc(var(--header-h) + var(--s-4));
		}
	}
	@media (min-width: 40rem) {
		tbody tr {
			display: table-row;
		}
		tbody tr > * {
			padding: var(--s-3) var(--s-3) var(--s-3) 0;
			border-top: 2px solid var(--bg);
			vertical-align: top;
		}
		thead {
			position: static;
			width: auto;
			height: auto;
			clip-path: none;
			overflow: visible;
		}
		thead th {
			text-align: left;
			font-size: var(--step-small);
			font-weight: 600;
			color: var(--muted);
			padding: 0 var(--s-3) var(--s-2) 0;
		}
		thead th:not(:first-child),
		td {
			width: 6.5rem;
			text-align: left;
		}
		td {
			display: table-cell;
			margin: 0;
		}
		td::before {
			content: none;
		}
		td.no {
			display: table-cell;
		}
		td.no::after {
			content: '';
		}
	}
</style>
