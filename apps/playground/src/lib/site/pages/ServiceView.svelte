<script lang="ts">
	// One service (`services` design letter). A "List": title and summary on the ground, the cover wide,
	// text and deliverables in two columns, the process as a ruled list. B "Cards": the cover is the first
	// screen with the title on it; the process as four tiles. C "Steps": the process first, as a large
	// numbered sequence, with a sticky-free price card beside the text.
	import type { DesignId } from '../designs';
	import Icon from '../Icon.svelte';
	import Img from '../Img.svelte';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import RichText from '../RichText.svelte';
	import type { Project, Service } from '../types';

	let {
		service,
		projects,
		others,
		design = 'a',
	}: { service: Service; projects: Project[]; others: Service[]; design?: DesignId } = $props();
	const cover = $derived(asMedia(service.cover));
	const start = $derived(`/contact?service=${encodeURIComponent(service.slug ?? '')}`);
	const steps = $derived(service.process ?? []);
	const items = $derived(service.deliverables ?? []);
	const num = (i: number) => String(i + 1).padStart(2, '0');
</script>

{#snippet cta()}
	<Link href={start} class="btn">Start a project</Link>
{/snippet}

{#snippet deliverables()}
	{#if items.length}
		<section class="deliv" aria-labelledby="deliv-h">
			<h2 id="deliv-h">What you get</h2>
			<ul>
				{#each items as d (d.id)}<li>{d.label}</li>{/each}
			</ul>
		</section>
	{/if}
{/snippet}

{#snippet related()}
	{#if projects.length}
		<section class="related section" aria-labelledby="rel-h">
			<div class="container">
				<h2 id="rel-h">Work in {service.title?.toLowerCase()}</h2>
				<ul class="rel">
					{#each projects as p, i (p.id)}
						<li class="reveal" use:reveal style:--i={i}>
							<Link href={`/work/${p.slug}`} class="rcard">
								<Pic media={asMedia(p.cover)} ratio={4 / 3} widths={[400, 700, 1000]} sizes="(min-width: 56rem) 30vw, 100vw" />
								<span class="rn">{p.title}</span>
								<span class="muted small">{[p.client, p.year].filter(Boolean).join(', ')}</span>
							</Link>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}
{/snippet}

{#snippet more()}
	{#if others.length}
		<nav class="container others" aria-label="Other services">
			<p class="small muted">Other services</p>
			<ul>
				{#each others as o (o.id)}
					<li><Link href={`/services/${o.slug}`} class="more">{o.title}<Icon name="arrow-up-right" size={20} /></Link></li>
				{/each}
			</ul>
		</nav>
	{/if}
{/snippet}

<article data-design={design}>
	{#if design === 'b'}
		<header class="b" class:photo={!!cover}>
			{#if cover}<div class="bg"><Img media={cover} fit="cover" eager widths={[800, 1400, 1800]} sizes="100vw" alt="" /></div>{/if}
			<div class="container inner">
				<p class="small kick">Service</p>
				<h1>{service.title}</h1>
				<p class="lead">{service.summary}</p>
				<p class="price">{service.priceFrom ?? ''}</p>
			</div>
		</header>
		<div class="container bbody section">
			<div class="prose-col"><RichText doc={service.body} /></div>
			<div class="side">
				{@render deliverables()}
				{@render cta()}
			</div>
		</div>
		{#if steps.length}
			<section class="surface section" aria-labelledby="proc-h">
				<div class="container">
					<h2 id="proc-h">How it works</h2>
					<ol class="tiles">
						{#each steps as s, i (s.id)}
							<li class="reveal" use:reveal style:--i={i}>
								<span class="n">{num(i)}</span>
								<h3>{s.title}</h3>
								<p class="muted">{s.text}</p>
							</li>
						{/each}
					</ol>
				</div>
			</section>
		{/if}
	{:else if design === 'c'}
		<header class="container c">
			<p class="small kick">Service</p>
			<h1>{service.title}</h1>
			<p class="lead muted">{service.summary}</p>
		</header>
		{#if steps.length}
			<section class="container csteps" aria-labelledby="proc-h">
				<h2 id="proc-h" class="visually-hidden">How it works</h2>
				<ol>
					{#each steps as s, i (s.id)}
						<li class="reveal" use:reveal>
							<span class="n">{num(i)}</span>
							<h3>{s.title}</h3>
							<p class="muted">{s.text}</p>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
		<div class="container cbody section">
			<div class="prose-col"><RichText doc={service.body} /></div>
			<aside class="card inverse">
				<p class="small muted">Price from</p>
				<p class="big">{service.priceFrom ?? 'On request'}</p>
				{@render deliverables()}
				<Link href={start} class="btn light">Start a project</Link>
			</aside>
		</div>
	{:else}
		<header class="container a">
			<p class="small kick">Service</p>
			<h1>{service.title}</h1>
			<div class="lede">
				<p class="lead">{service.summary}</p>
				<p class="price">{service.priceFrom ?? ''}</p>
			</div>
		</header>
		{#if cover}
			<div class="container wide"><Pic media={cover} ratio={21 / 9} eager widths={[700, 1200, 1800]} sizes="100vw" alt="" /></div>
		{/if}
		<div class="container abody section">
			<div class="prose-col"><RichText doc={service.body} /></div>
			<div class="side">
				{@render deliverables()}
				{@render cta()}
			</div>
		</div>
		{#if steps.length}
			<section class="container aproc" aria-labelledby="proc-h">
				<h2 id="proc-h">How it works</h2>
				<ol>
					{#each steps as s, i (s.id)}
						<li class="reveal" use:reveal>
							<span class="n">{num(i)}</span>
							<h3>{s.title}</h3>
							<p class="muted">{s.text}</p>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/if}

	{@render related()}

	<section class="close accent-field section">
		<div class="container closer">
			<h2>Start a {service.title?.toLowerCase()} project</h2>
			<Link href={start} class="btn light">Start a project</Link>
		</div>
	</section>
	{@render more()}
</article>

<style>
	ul,
	ol {
		list-style: none;
	}
	h2 {
		font-size: var(--step-h2);
	}
	.kick {
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.price {
		font-weight: 600;
	}
	.prose-col :global(.prose) {
		font-size: var(--step-lead);
		line-height: 1.5;
	}
	.deliv {
		display: grid;
		gap: var(--s-3);
		margin-bottom: var(--s-4);
	}
	.deliv h2 {
		font-size: var(--step-h3);
	}
	.deliv li {
		padding-block: 0.6rem;
		border-bottom: 1px solid var(--line);
	}
	.side {
		display: grid;
		gap: var(--s-3);
		align-content: start;
		justify-items: start;
	}

	/* A */
	.a {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-5);
	}
	.a h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	.a .lede {
		display: grid;
		gap: var(--s-2);
		max-width: 44rem;
	}
	.wide :global(.pic) {
		min-height: 11rem;
	}
	.abody {
		display: grid;
		gap: var(--s-5);
	}
	.aproc {
		display: grid;
		gap: var(--s-5);
		padding-bottom: var(--section);
	}
	.aproc ol {
		display: grid;
	}
	.aproc li {
		display: grid;
		grid-template-columns: 2.5rem 1fr;
		gap: var(--s-1) var(--s-3);
		padding-block: var(--s-4);
		border-top: 1px solid var(--line);
	}
	.aproc li p {
		grid-column: 2;
	}
	.n {
		font-weight: 600;
		font-size: var(--step-small);
		padding-top: 0.4rem;
	}
	@media (min-width: 56rem) {
		.abody {
			grid-template-columns: 7fr 4fr;
			gap: var(--s-6);
		}
		.aproc li {
			grid-template-columns: 4rem minmax(0, 4fr) minmax(0, 5fr);
			align-items: baseline;
		}
		.aproc li p {
			grid-column: auto;
		}
	}

	/* B */
	.b {
		position: relative;
		display: flex;
		align-items: flex-end;
		min-height: clamp(26rem, 70svh, 44rem);
		padding-block: var(--s-7) var(--s-6);
		overflow: hidden;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.b.photo {
		color: #fff;
		background: #26282a;
	}
	.b .bg {
		position: absolute;
		inset: 0;
	}
	.b.photo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.82), rgb(0 0 0 / 0.35) 65%, rgb(0 0 0 / 0.2));
	}
	.b .inner {
		position: relative;
		z-index: 1;
		display: grid;
		gap: var(--s-3);
		justify-items: start;
	}
	.b h1 {
		font-size: clamp(3.4rem, 0.8rem + 11vw, 10rem);
	}
	.b .lead {
		max-width: 40rem;
	}
	.bbody {
		display: grid;
		gap: var(--s-5);
	}
	.tiles {
		display: grid;
		gap: var(--s-4);
		margin-top: var(--s-5);
	}
	.tiles li {
		display: grid;
		gap: var(--s-2);
		align-content: start;
		padding: var(--s-4);
		background: var(--bg);
	}
	.tiles .n {
		font: 3rem / 1 var(--font-display);
		padding: 0;
		color: var(--accent);
	}
	@media (min-width: 56rem) {
		.bbody {
			grid-template-columns: 4fr 7fr;
			gap: var(--s-6);
		}
		.bbody .prose-col {
			order: 2;
		}
		.bbody .side {
			order: 1;
		}
		.tiles {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	/* C */
	.c {
		display: grid;
		gap: var(--s-3);
		padding-block: var(--s-5) var(--s-6);
	}
	.c h1 {
		font-size: clamp(3rem, 1rem + 8vw, 8rem);
	}
	.csteps ol {
		display: grid;
	}
	.csteps li {
		display: grid;
		gap: var(--s-2);
		padding-block: var(--s-5);
		border-top: 2px solid var(--ink);
	}
	.csteps .n {
		font: clamp(3.5rem, 2rem + 6vw, 7rem) / 0.9 var(--font-display);
		color: var(--accent);
		padding: 0;
	}
	.csteps h3 {
		font-size: clamp(1.8rem, 1.2rem + 2vw, 2.8rem);
	}
	.cbody {
		display: grid;
		gap: var(--s-5);
	}
	.card {
		display: grid;
		gap: var(--s-3);
		align-content: start;
		justify-items: start;
		padding: var(--s-4);
	}
	.card .big {
		font: var(--step-h3) / 1 var(--font-display);
	}
	.card :global(.deliv li) {
		border-color: color-mix(in srgb, var(--bg) 25%, var(--ink));
	}
	.card .deliv {
		width: 100%;
	}
	@media (min-width: 56rem) {
		.csteps li {
			grid-template-columns: 9rem minmax(0, 5fr) minmax(0, 5fr);
			gap: var(--s-5);
			align-items: baseline;
		}
		.cbody {
			grid-template-columns: 7fr 4fr;
			gap: var(--s-6);
			align-items: start;
		}
	}

	/* Related, closing */
	.related h2 {
		margin-bottom: var(--s-5);
	}
	.rel {
		display: grid;
		gap: var(--s-5) var(--s-4);
	}
	.related :global(.rcard) {
		display: grid;
		gap: 0.35rem;
		text-decoration: none;
	}
	.rn {
		font: var(--step-h3) / 1.05 var(--font-display);
	}
	.related :global(.rcard:hover .rn) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.15em;
	}
	@media (min-width: 56rem) {
		.rel {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.closer {
		display: grid;
		gap: var(--s-4);
		justify-items: start;
	}
	.closer h2 {
		max-width: 16ch;
	}
	.others {
		display: grid;
		gap: var(--s-2);
		padding-block: var(--s-5);
	}
	.others ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
	}
</style>
