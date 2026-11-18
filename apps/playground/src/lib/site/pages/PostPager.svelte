<script lang="ts">
	// Newer / older note links under a post, each with its cover.
	import Link from '../Link.svelte';
	import Pic from '../Pic.svelte';
	import { fmtDate } from '../format';
	import { asMedia } from '../media';

	interface Item {
		slug: string;
		title: string;
		cover?: unknown;
		publishedAt?: string | null;
	}
	let { newer, older, tone = 'bg' }: { newer: Item | null; older: Item | null; tone?: 'bg' | 'slate' } = $props();
	const entries = $derived([
		{ item: older, label: 'Older note' },
		{ item: newer, label: 'Newer note' },
	]);
</script>

{#if newer || older}
	<nav class={['pn', tone]} aria-label="More notes">
		{#each entries as { item, label } (label)}
			{#if item}
				<Link href={`/journal/${item.slug}`} class="pn-link" rel={label === 'Older note' ? 'prev' : 'next'}>
					<span class="pic"><Pic media={asMedia(item.cover)} ratio={1} widths={[200, 400]} sizes="7rem" alt="" /></span>
					<span class="txt"><span class="small">{label}, {fmtDate(item.publishedAt)}</span><strong>{item.title}</strong></span>
				</Link>
			{/if}
		{/each}
	</nav>
{/if}

<style>
	.pn {
		display: grid;
		gap: var(--s-4);
	}
	.pn :global(.pn-link) {
		display: grid;
		grid-template-columns: 5rem 1fr;
		gap: var(--s-4);
		align-items: center;
		text-decoration: none;
		padding-block: var(--s-3);
		border-top: 1px solid color-mix(in srgb, currentColor 30%, transparent); /* a real table row, taste-skill-ignore */
		min-height: 2.75rem;
	}
	.txt {
		display: grid;
		gap: var(--s-1);
	}
	strong {
		font: 700 clamp(1.5rem, 1.2rem + 1vw, 2rem) / 1.05 var(--font-display);
	}
	.pn :global(.pn-link:hover strong) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.12em;
	}
	@media (min-width: 56rem) {
		.pn {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-6);
		}
	}
</style>
