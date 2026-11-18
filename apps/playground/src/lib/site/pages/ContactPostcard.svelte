<script lang="ts">
	// Contact, design B "Postcard": immersive. The valley fills the first screen; the page is one solid
	// card on an earth field, message on the left, address on the right under an altitude "stamp".
	import ContactForms from './ContactForms.svelte';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import RichText from '../RichText.svelte';
	import Section from '../Section.svelte';
	import { asMedia } from '../media';
	import type { Shell } from '../shell';
	import { telHref, waHref } from '../shell';
	import type { BlockOf, Page, PageBlock } from '../types';
	import { pick } from './pagedata';

	let { shell, blocks, cover }: { shell: Shell; blocks: PageBlock[]; cover: Page['cover'] } = $props();
	const loc = $derived(pick(blocks, 'location') as BlockOf<'location'> | undefined);
	const alt = $derived(pick(blocks, 'richText') as BlockOf<'richText'> | undefined);
	const dirs = $derived(loc?.directions ?? []);
	const c = $derived(shell.contact);
</script>

<header class="hero on-dark">
	<div class="photo"><Img media={asMedia(cover)} eager fit="cover" widths={[800, 1400, 2000]} sizes="100vw" alt="" /></div>
	<div class="container inner">
		<h1>Contact</h1>
		<p class="lead">Write, call or message us. We answer within a day, usually sooner.</p>
	</div>
</header>

<Section id="form" tone="earth">
	<div class="card">
		<div class="msg">
			<h2>Write to us</h2>
			<ContactForms id="p" />
		</div>
		<div class="addr on-dark">
			<p class="stamp" aria-label="3,500 metres above the sea"><strong>3,500</strong><span>metres</span></p>
			{#if c.address}<address>{c.address}</address>{/if}
			<p class="links">
				{#if c.phone}<Link class="link" href={telHref(c.phone)}>{c.phone}</Link>{/if}
				{#if c.whatsapp}<Link class="link" href={waHref(c.whatsapp)}>WhatsApp</Link>{/if}
				{#if c.email}<Link class="link" href={`mailto:${c.email}`}>{c.email}</Link>{/if}
			</p>
			{#if shell.season}<p class="small">{shell.season}</p>{/if}
			{#if shell.checkIn}<p class="small">Check-in {shell.checkIn}, check-out {shell.checkOut}</p>{/if}
			{#if c.mapUrl}<Link href={c.mapUrl} class="btn light">Open the map</Link>{/if}
		</div>
	</div>
</Section>

<Section tone="slate">
	<div class="way">
		<h2>{loc?.heading ?? 'Getting here'}</h2>
		<ul class="dirs">
			{#each dirs as d, i (d.id ?? i)}<li><h3>{d.label}</h3><p class="small">{d.text}</p></li>{/each}
		</ul>
		{#if alt}<div class="alt"><h3>{alt.heading}</h3><RichText doc={alt.body} /></div>{/if}
	</div>
</Section>

<style>
	.hero {
		position: relative;
		min-height: 100svh;
		display: grid;
		align-items: end;
		color: var(--accent-ink);
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
		inset: 0;
		background: linear-gradient(to top, var(--scrim), transparent 60%); /* taste-skill-ignore: neutral scrim under text on a photograph */
	}
	.photo :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.inner {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-7) var(--s-5);
	}
	.inner h1 {
		font-size: clamp(4.5rem, 1rem + 22vw, 17rem);
		line-height: 0.8;
		margin-bottom: var(--s-2);
	}
	.card {
		display: grid;
		background: var(--bg);
		color: var(--ink);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.msg {
		display: grid;
		gap: var(--s-5);
		padding: var(--s-5);
		background: var(--bg);
		--field-bg: var(--surface);
		min-width: 0;
	}
	.addr {
		display: grid;
		gap: var(--s-3);
		align-content: start;
		justify-items: start;
		padding: var(--s-5);
		background: var(--slate);
		color: var(--slate-ink);
	}
	.stamp {
		display: grid;
		justify-items: center;
		padding: var(--s-3) var(--s-4);
		background: var(--apricot);
		color: var(--ink);
		border-radius: var(--radius);
		font-family: var(--font-display);
		line-height: 1;
		justify-self: end;
		transform: rotate(3deg);
	}
	.stamp strong {
		font-size: 2.2rem;
	}
	.stamp span {
		font: 600 0.9rem/1 var(--font-text);
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
	.way {
		display: grid;
		gap: var(--s-6);
	}
	.dirs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-5);
	}
	.dirs li {
		display: grid;
		gap: var(--s-1);
	}
	.dirs h3,
	.alt h3 {
		font-size: var(--step-lead);
		color: var(--apricot);
	}
	.alt {
		display: grid;
		gap: var(--s-3);
		max-width: 44rem;
	}
	@media (min-width: 56rem) {
		.card {
			grid-template-columns: 7fr 5fr;
		}
		.msg,
		.addr {
			padding: var(--s-7);
		}
		.dirs {
			grid-template-columns: repeat(4, 1fr);
			gap: var(--s-5);
		}
	}
</style>
