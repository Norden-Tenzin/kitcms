<script lang="ts">
	// Contact, design C "Directions": structured. A sticky datasheet of the house's details beside a
	// column of tables: the routes in, altitude advice in equal tiles, then the form.
	import ContactForms from './ContactForms.svelte';
	import Link from '../Link.svelte';
	import RichText from '../RichText.svelte';
	import type { Shell } from '../shell';
	import { telHref, waHref } from '../shell';
	import type { BlockOf, PageBlock } from '../types';
	import { pick } from './pagedata';

	let { shell, blocks }: { shell: Shell; blocks: PageBlock[] } = $props();
	const loc = $derived(pick(blocks, 'location') as BlockOf<'location'> | undefined);
	const alt = $derived(pick(blocks, 'richText') as BlockOf<'richText'> | undefined);
	const dirs = $derived(loc?.directions ?? []);
	const c = $derived(shell.contact);
</script>

<div class="container cols pt-hdr">
	<aside class="sheet">
		<h1>Directions</h1>
		<dl>
			{#if c.address}<div><dt>Address</dt><dd class="addr">{c.address}</dd></div>{/if}
			{#if c.phone}<div><dt>Phone</dt><dd><Link class="link" href={telHref(c.phone)}>{c.phone}</Link></dd></div>{/if}
			{#if c.whatsapp}<div><dt>WhatsApp</dt><dd><Link class="link" href={waHref(c.whatsapp)}>{c.whatsapp}</Link></dd></div>{/if}
			{#if c.email}<div><dt>Email</dt><dd><Link class="link" href={`mailto:${c.email}`}>{c.email}</Link></dd></div>{/if}
			{#if shell.checkIn}<div><dt>Check-in</dt><dd>{shell.checkIn}</dd></div>{/if}
			{#if shell.checkOut}<div><dt>Check-out</dt><dd>{shell.checkOut}</dd></div>{/if}
			{#if shell.season}<div><dt>Season</dt><dd>{shell.season}</dd></div>{/if}
		</dl>
		{#if c.mapUrl}<Link href={c.mapUrl} class="btn">Open the map</Link>{/if}
	</aside>

	<div class="main">
		{#if dirs.length}
			<section class="panel">
				<table>
					<caption>{loc?.heading ?? 'Getting here'}</caption>
					<thead><tr><th scope="col">From</th><th scope="col">The way</th></tr></thead>
					<tbody>
						{#each dirs as d, i (d.id ?? i)}<tr><th scope="row">{d.label}</th><td>{d.text}</td></tr>{/each}
					</tbody>
				</table>
			</section>
		{/if}
		{#if alt}
			<section class="panel">
				<h2>{alt.heading}</h2>
				<div class="tiles"><RichText doc={alt.body} /></div>
			</section>
		{/if}
		<section class="panel" id="form">
			<h2>Tell us when</h2>
			<ContactForms id="d" />
		</section>
	</div>
</div>

<style>
	.cols {
		display: grid;
		gap: var(--s-6);
		padding-bottom: var(--s-7);
	}
	.sheet {
		display: grid;
		gap: var(--s-5);
		align-content: start;
		justify-items: start;
	}
	.sheet h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 7rem);
	}
	dl {
		margin: 0;
		width: 100%;
		display: grid;
	}
	dl > div {
		display: grid;
		gap: 0.1rem;
		padding-block: var(--s-3);
		border-top: 2px solid var(--surface);
	}
	dt {
		font-size: var(--step-small);
		color: var(--muted);
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	.addr {
		white-space: pre-line;
	}
	.main {
		display: grid;
		gap: var(--s-4);
		min-width: 0;
		align-content: start;
	}
	.panel {
		background: var(--surface);
		border-radius: var(--radius);
		padding: var(--s-5);
		display: grid;
		gap: var(--s-4);
		--field-bg: var(--bg);
		min-width: 0;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	caption {
		text-align: left;
		font: 700 clamp(2.25rem, 1.3rem + 3.6vw, 4rem) / 1 var(--font-display);
		margin-bottom: var(--s-3);
	}
	thead {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	tbody tr {
		display: grid;
		gap: 0.15rem;
		padding-block: var(--s-3);
		border-top: 2px solid var(--bg);
	}
	th[scope='row'] {
		text-align: left;
		font-weight: 600;
	}
	td {
		color: var(--ink);
	}
	.panel .tiles :global(ul) {
		list-style: none;
		padding: 0;
		margin: var(--s-4) 0 0;
		display: grid;
		gap: var(--s-3);
	}
	.panel .tiles :global(li) {
		background: var(--bg);
		padding: var(--s-4);
		border-radius: var(--radius);
		margin: 0;
	}
	@media (min-width: 56rem) {
		.cols {
			grid-template-columns: 4fr 7fr;
			gap: var(--s-7);
			align-items: start;
		}
		.sheet {
			position: sticky;
			top: calc(var(--header-h) + var(--s-4));
		}
		.panel {
			padding: var(--s-6);
		}
		.panel .tiles :global(ul) {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (min-width: 40rem) {
		thead {
			position: static;
			width: auto;
			height: auto;
			clip-path: none;
			overflow: visible;
		}
		tbody tr {
			display: table-row;
		}
		tbody tr > * {
			padding: var(--s-3) var(--s-4) var(--s-3) 0;
			border-top: 2px solid var(--bg);
			vertical-align: top;
		}
		thead th {
			text-align: left;
			font-size: var(--step-small);
			font-weight: 600;
			color: var(--muted);
			padding: 0 var(--s-4) var(--s-2) 0;
		}
		th[scope='row'] {
			width: 30%;
		}
	}
</style>
