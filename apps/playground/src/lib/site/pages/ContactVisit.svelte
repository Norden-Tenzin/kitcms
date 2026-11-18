<script lang="ts">
	// Contact, design A "Visit": editorial. Pictures and notes at uneven offsets: the way in told as four
	// short notes, the details small beside a picture, the form last.
	import ContactForms from './ContactForms.svelte';
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import { reveal } from '../reveal';
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

<header class="container head pt-hdr">
	<h1>Visit</h1>
	<p class="lead">Write, call or message us. We answer within a day, usually sooner.</p>
</header>

<div class="container lede">
	<Pic media={asMedia(loc?.image)} ratio={4 / 5} eager widths={[500, 800, 1200]} sizes="(min-width: 56rem) 38vw, 100vw" class="pic" />
	<div class="details">
		{#if c.address}<address>{c.address}</address>{/if}
		<p class="links">
			{#if c.phone}<Link class="link" href={telHref(c.phone)}>{c.phone}</Link>{/if}
			{#if c.whatsapp}<Link class="link" href={waHref(c.whatsapp)}>WhatsApp</Link>{/if}
			{#if c.email}<Link class="link" href={`mailto:${c.email}`}>{c.email}</Link>{/if}
		</p>
		{#if shell.season}<p class="small">{shell.season}</p>{/if}
		{#if shell.checkIn}<p class="small">Check-in {shell.checkIn}, check-out {shell.checkOut}</p>{/if}
		{#if c.mapUrl}<Link href={c.mapUrl} class="btn ghost">Open the map</Link>{/if}
	</div>
</div>

{#if dirs.length}
	<Section>
		<h2 class="h2">{loc?.heading ?? 'Getting here'}</h2>
		<ol class="notes">
			{#each dirs as d, i (d.id ?? i)}
				<li class="reveal" use:reveal style:--i={i}><h3>{d.label}</h3><p>{d.text}</p></li>
			{/each}
		</ol>
	</Section>
{/if}

{#if alt}
	<Section>
		<div class="alt"><h2>{alt.heading}</h2><RichText doc={alt.body} /></div>
	</Section>
{/if}

<Section id="form" tone="surface">
	<div class="formcols">
		<h2>Tell us when</h2>
		<div style:--field-bg="var(--bg)"><ContactForms id="v" /></div>
	</div>
</Section>

<style>
	.head {
		display: grid;
		gap: var(--s-4);
		padding-bottom: var(--s-6);
	}
	.lede {
		display: grid;
		gap: var(--s-5);
	}
	.details {
		display: grid;
		gap: var(--s-3);
		justify-items: start;
		align-content: start;
	}
	address {
		font-style: normal;
		white-space: pre-line;
		font-size: var(--step-lead);
		line-height: 1.3;
	}
	.links {
		display: grid;
		justify-items: start;
	}
	.notes {
		list-style: none;
		margin: var(--s-6) 0 0;
		padding: 0;
		display: grid;
		gap: var(--s-6);
	}
	.notes li {
		display: grid;
		gap: var(--s-2);
		max-width: 30rem;
	}
	.alt {
		display: grid;
		gap: var(--s-4);
		max-width: 44rem;
	}
	.formcols {
		display: grid;
		gap: var(--s-5);
	}
	@media (min-width: 56rem) {
		.lede {
			grid-template-columns: repeat(12, 1fr);
			gap: var(--s-6);
			align-items: start;
		}
		.lede :global(.pic) {
			grid-column: 2 / 7;
		}
		.details {
			grid-column: 8 / 13;
			padding-top: var(--s-8, 6rem);
		}
		.notes {
			grid-template-columns: repeat(2, 1fr);
			gap: var(--s-6) var(--s-8, 6rem);
		}
		.notes li:nth-child(even) {
			margin-top: var(--s-7);
		}
		.alt {
			margin-left: 16.666%;
		}
		.formcols {
			grid-template-columns: 4fr 7fr;
			gap: var(--s-7);
		}
	}
</style>
