<script lang="ts">
	// /services. A "List": the title very large, then each service as a full-width row (number, title,
	// summary, price). B "Cards": a tinted field with a photograph card per service. C "Steps": each
	// service with its own process written out as numbered steps beside it.
	import type { DesignId } from '../designs';
	import Icon from '../Icon.svelte';
	import Link from '../Link.svelte';
	import { asMedia } from '../media';
	import Pic from '../Pic.svelte';
	import { reveal } from '../reveal';
	import type { Service } from '../types';

	let { services, design = 'a' }: { services: Service[]; design?: DesignId } = $props();
	const num = (i: number) => String(i + 1).padStart(2, '0');
</script>

<div class="wrap" data-design={design}>
	<header class="container head">
		<h1>What we make</h1>
		<p class="lead muted">
			Four kinds of work, each with a fixed way of working and a price to start from. Pick one, or send a brief and
			we will tell you which fits.
		</p>
	</header>

	{#if design === 'b'}
		<section class="surface section">
			<ul class="container cards">
				{#each services as s, i (s.id)}
					<li class="reveal" use:reveal style:--i={i % 2}>
						<Link href={`/services/${s.slug}`} class="card">
							<Pic media={asMedia(s.cover)} ratio={4 / 3} eager={i < 2} widths={[500, 900, 1300]} sizes="(min-width: 56rem) 45vw, 100vw" />
							<span class="body">
								<span class="top"><Icon name={s.icon} size={28} /><span class="price">{s.priceFrom ?? ''}</span></span>
								<span class="title">{s.title}</span>
								<span class="muted">{s.summary}</span>
								<span class="more">See the service <Icon name="arrow" size={20} /></span>
							</span>
						</Link>
					</li>
				{/each}
			</ul>
		</section>
	{:else if design === 'c'}
		<ol class="container steps">
			{#each services as s, i (s.id)}
				<li class="reveal" use:reveal>
					<span class="n">{num(i)}</span>
					<div class="main">
						<h2><Link href={`/services/${s.slug}`}>{s.title}</Link></h2>
						<p class="muted">{s.summary}</p>
						<p class="price">{s.priceFrom ?? ''}</p>
					</div>
					<ol class="proc" aria-label={`How ${s.title} works`}>
						{#each s.process ?? [] as step, j (step.id)}
							<li><span class="k">{j + 1}</span> {step.title}</li>
						{/each}
					</ol>
				</li>
			{/each}
		</ol>
	{:else}
		<ul class="container rows">
			{#each services as s, i (s.id)}
				<li class="reveal" use:reveal>
					<Link href={`/services/${s.slug}`} class="row">
						<span class="n">{num(i)}</span>
						<span class="title">{s.title}</span>
						<span class="sum muted">{s.summary}</span>
						<span class="price">{s.priceFrom ?? ''}</span>
						<span class="go"><Icon name="arrow-up-right" size={28} /></span>
					</Link>
				</li>
			{/each}
		</ul>
	{/if}

	<section class="end accent-field section">
		<div class="container end-in">
			<h2>Not sure which one?</h2>
			<p class="lead">Tell us what you are making. We will say which service fits, or whether we are the right studio.</p>
			<Link href="/contact" class="btn light">Send a brief</Link>
		</div>
	</section>
</div>

<style>
	ul,
	ol {
		list-style: none;
	}
	.head {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-5) var(--s-6);
	}
	.head h1 {
		font-size: clamp(3.4rem, 1rem + 10vw, 9rem);
	}
	.price {
		font-weight: 600;
		font-size: var(--step-small);
	}

	/* A */
	.rows {
		display: grid;
	}
	.rows li {
		border-top: 1px solid var(--line);
	}
	.rows li:last-child {
		border-bottom: 1px solid var(--line);
	}
	.rows :global(.row) {
		display: grid;
		grid-template-columns: 2.25rem 1fr auto;
		gap: var(--s-2) var(--s-3);
		padding-block: var(--s-4);
		text-decoration: none;
		align-items: baseline;
	}
	.rows .n {
		font-weight: 600;
		font-size: var(--step-small);
	}
	.rows .title {
		font: clamp(2.2rem, 1.2rem + 4vw, 4.5rem) / 1 var(--font-display);
		letter-spacing: -0.02em;
	}
	.rows .sum {
		grid-column: 2 / 4;
	}
	.rows .price {
		grid-column: 2 / 4;
	}
	.rows .go {
		grid-column: 3;
		grid-row: 1;
		align-self: center;
		transition: transform 0.25s var(--ease);
	}
	.rows :global(.row:hover .title) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	.rows :global(.row:hover .go) {
		transform: translate(4px, -4px);
	}
	@media (min-width: 56rem) {
		.rows :global(.row) {
			grid-template-columns: 4rem minmax(0, 5fr) minmax(0, 4fr) 9rem 2rem;
			padding-block: var(--s-5);
		}
		.rows .sum,
		.rows .price,
		.rows .go {
			grid-column: auto;
			grid-row: auto;
		}
		.rows .price {
			text-align: right;
		}
	}

	/* B */
	.cards {
		display: grid;
		gap: var(--s-5) var(--s-4);
	}
	.cards :global(.card) {
		display: grid;
		gap: var(--s-3);
		text-decoration: none;
	}
	.cards .body {
		display: grid;
		gap: var(--s-2);
		justify-items: start;
	}
	.cards .top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
	}
	.cards .title {
		font: var(--step-h3) / 1.05 var(--font-display);
	}
	.cards :global(.card:hover .title) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.15em;
	}
	@media (min-width: 56rem) {
		.cards {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-6) var(--s-5);
		}
		.cards li:nth-child(even) {
			margin-top: var(--s-6);
		}
	}

	/* C */
	.steps {
		display: grid;
	}
	.steps > li {
		display: grid;
		gap: var(--s-3);
		padding-block: var(--s-5);
		border-top: 2px solid var(--ink);
	}
	.steps > li > .n {
		font: clamp(3rem, 2rem + 4vw, 5.5rem) / 0.9 var(--font-display);
		color: var(--accent);
	}
	.steps .main {
		display: grid;
		gap: var(--s-2);
		justify-items: start;
	}
	.steps h2 {
		font-size: clamp(2.2rem, 1.4rem + 3vw, 3.6rem);
	}
	.steps h2 :global(a) {
		text-decoration: none;
	}
	.steps h2 :global(a:hover) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	.proc {
		display: grid;
		gap: 0;
		align-content: start;
	}
	.proc li {
		display: flex;
		gap: var(--s-3);
		align-items: baseline;
		padding-block: 0.6rem;
		border-bottom: 1px solid var(--line);
		font-weight: 500;
	}
	.proc .k {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		background: var(--ink);
		color: var(--bg);
		font-size: 0.8125rem;
		font-weight: 600;
	}
	@media (min-width: 56rem) {
		.steps > li {
			grid-template-columns: 8rem minmax(0, 5fr) minmax(0, 5fr);
			gap: var(--s-5);
		}
	}

	/* End */
	.end {
		margin-top: var(--section);
	}
	[data-design='b'] .end {
		margin-top: 0;
	}
	.end-in {
		display: grid;
		gap: var(--s-4);
		justify-items: start;
	}
	@media (min-width: 56rem) {
		.end-in {
			grid-template-columns: 1fr 1fr;
			align-items: end;
		}
		.end-in h2 {
			grid-row: span 2;
		}
		.end-in :global(.btn) {
			justify-self: start;
		}
	}
</style>
