<script lang="ts">
	// /contact (`contact` design). Both forms are on every design: the project brief (`#brief`) and the
	// short message (`#message`). A "Form first": the brief is the first thing, details in a narrow
	// column beside it, the short message below. B "Split": an ink panel with the details and a map link
	// beside the forms. C "Directory": the ways to reach us as large tiles first, then the two forms
	// side by side.
	import { page } from '$app/state';
	import type { DesignId } from '../designs';
	import Icon from '../Icon.svelte';
	import Link from '../Link.svelte';
	import { telHref, type Shell } from '../shell';
	import EnquiryFields from './EnquiryFields.svelte';

	let { shell, design = 'a' }: { shell: Shell; design?: DesignId } = $props();
	const c = $derived(shell.contact);
	const service = $derived(page.url.searchParams.get('service') ?? '');
	const addressLines = $derived(c.address.split('\n').filter(Boolean));
</script>

{#snippet brief()}
	<section id="brief" class="form-block" aria-labelledby="brief-h">
		<h2 id="brief-h">Send a brief</h2>
		<p class="muted">Tell us what you are making, roughly when and for how much. We reply within one working day.</p>
		<EnquiryFields form="brief" {service} id="brief" />
	</section>
{/snippet}

{#snippet message()}
	<section id="message" class="form-block" aria-labelledby="message-h">
		<h2 id="message-h">Just a question?</h2>
		<p class="muted">A line is enough. No brief needed.</p>
		<EnquiryFields form="contact" id="message" />
	</section>
{/snippet}

{#snippet details()}
	<dl class="details">
		{#if c.email}<div><dt>Email</dt><dd><Link href={`mailto:${c.email}`} class="big">{c.email}</Link></dd></div>{/if}
		{#if c.phone}<div><dt>Phone</dt><dd><Link href={telHref(c.phone)} class="link">{c.phone}</Link></dd></div>{/if}
		{#if addressLines.length}
			<div>
				<dt>Studio</dt>
				<dd>
					{#each addressLines as l, i (i)}{l}<br />{/each}
					{#if c.mapUrl}<Link href={c.mapUrl} class="more">Open in maps <Icon name="arrow-up-right" size={18} /></Link>{/if}
				</dd>
			</div>
		{/if}
		{#if c.hours}<div><dt>Hours</dt><dd>{c.hours}</dd></div>{/if}
	</dl>
{/snippet}

<div data-design={design}>
	{#if design === 'b'}
		<div class="b">
			<aside class="panel inverse">
				<div class="panel-in">
					<h1>Let us talk</h1>
					<p class="lead">Send a brief, or write to us. We answer within one working day.</p>
					{@render details()}
				</div>
			</aside>
			<div class="forms">
				{@render brief()}
				{@render message()}
			</div>
		</div>
	{:else if design === 'c'}
		<header class="container c-head">
			<h1>Contact</h1>
			<p class="lead muted">Four ways to reach us. The brief gets the fastest, most useful answer.</p>
		</header>
		<ul class="container tiles">
			{#if c.email}
				<li><Link href={`mailto:${c.email}`} class="tile accent-field"><span class="small">Email</span><span class="tv">{c.email}</span><Icon name="arrow-up-right" size={28} /></Link></li>
			{/if}
			{#if c.phone}
				<li><Link href={telHref(c.phone)} class="tile"><span class="small muted">Phone</span><span class="tv">{c.phone}</span><Icon name="arrow-up-right" size={28} /></Link></li>
			{/if}
			{#if c.address}
				<li>
					<Link href={c.mapUrl || '#message'} class="tile"><span class="small muted">Studio</span><span class="tv">{addressLines.join(', ')}</span><Icon name="arrow-up-right" size={28} /></Link>
				</li>
			{/if}
			{#if c.hours}
				<li><div class="tile"><span class="small muted">Hours</span><span class="tv">{c.hours}</span></div></li>
			{/if}
		</ul>
		<div class="container c-forms">
			{@render brief()}
			{@render message()}
		</div>
	{:else}
		<header class="container a-head">
			<h1>Tell us what you are making</h1>
		</header>
		<div class="container a-body">
			{@render brief()}
			<aside class="aside">
				{@render details()}
				<div class="surface a-msg">{@render message()}</div>
			</aside>
		</div>
	{/if}
</div>

<style>
	h2 {
		font-size: var(--step-h3);
	}
	.form-block {
		display: grid;
		gap: var(--s-3);
		align-content: start;
		scroll-margin-top: calc(var(--header-h) + 1rem);
	}
	.details {
		display: grid;
		gap: 0;
		margin: 0;
	}
	.details > div {
		display: grid;
		gap: 0.2rem;
		padding-block: var(--s-3);
		border-top: 1px solid var(--line);
	}
	.details dt {
		font-size: var(--step-small);
		font-weight: 600;
		opacity: 0.8;
	}
	.details dd {
		margin: 0;
	}
	.details :global(.big) {
		font: var(--step-h3) / 1.1 var(--font-display);
		overflow-wrap: anywhere;
	}
	.details :global(.link) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}

	/* A */
	.a-head {
		padding-block: var(--s-5) var(--s-5);
	}
	.a-head h1 {
		font-size: clamp(3rem, 1rem + 8vw, 7.5rem);
		max-width: 14ch;
	}
	.a-body {
		display: grid;
		gap: var(--s-6);
		padding-bottom: var(--section);
	}
	.aside {
		display: grid;
		gap: var(--s-5);
		align-content: start;
	}
	.a-msg {
		padding: var(--s-4);
		--field: var(--bg);
	}
	@media (min-width: 56rem) {
		.a-body {
			grid-template-columns: 7fr 4fr;
			gap: var(--s-7);
		}
	}

	/* B */
	.b {
		display: grid;
	}
	.panel {
		padding: var(--s-6) var(--gutter);
	}
	.panel-in {
		display: grid;
		gap: var(--s-4);
		align-content: start;
		max-width: 38rem;
	}
	.panel h1 {
		font-size: clamp(3rem, 1rem + 6vw, 6rem);
	}
	.panel .details > div {
		border-color: color-mix(in srgb, var(--bg) 25%, var(--ink));
	}
	.forms {
		display: grid;
		gap: var(--s-7);
		padding: var(--s-6) var(--gutter) var(--section);
		max-width: 46rem;
	}
	@media (min-width: 56rem) {
		.b {
			grid-template-columns: 5fr 7fr;
			min-height: calc(100svh - var(--header-h));
		}
		.panel {
			padding-inline: max(var(--gutter), calc((100vw - var(--maxw)) / 2 + var(--gutter))) var(--s-6);
		}
		.forms {
			padding-inline: var(--s-6) var(--gutter);
		}
	}

	/* C */
	.c-head {
		display: grid;
		gap: var(--s-3);
		padding-block: var(--s-5);
	}
	.c-head h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	.tiles {
		list-style: none;
		display: grid;
		gap: var(--s-3);
	}
	.tiles :global(.tile) {
		display: grid;
		gap: var(--s-2);
		align-content: space-between;
		min-height: 11rem;
		height: 100%;
		padding: var(--s-4);
		background: var(--surface);
		text-decoration: none;
		position: relative;
	}
	.tiles :global(.tile.accent-field) {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.tiles :global(a.tile:hover) {
		background: var(--surface-2);
	}
	.tiles :global(a.tile.accent-field:hover) {
		background: color-mix(in srgb, var(--accent) 82%, var(--ink));
	}
	.tiles :global(.tile) :global(svg) {
		position: absolute;
		top: var(--s-4);
		right: var(--s-4);
	}
	.tv {
		font: clamp(1.6rem, 1.1rem + 1.6vw, 2.2rem) / 1.1 var(--font-display);
		overflow-wrap: anywhere;
	}
	.c-forms {
		display: grid;
		gap: var(--s-7);
		padding-block: var(--s-7) var(--section);
	}
	@media (min-width: 40rem) {
		.tiles {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (min-width: 56rem) {
		.tiles {
			grid-template-columns: 1fr 1fr;
		}
		.c-forms {
			grid-template-columns: 7fr 5fr;
			gap: var(--s-6);
			align-items: start;
		}
	}
</style>
