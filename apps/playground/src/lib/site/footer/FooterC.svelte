<script lang="ts">
	// Signboard: the name returns at full width, like the board over a shop door.
	import Link from '../Link.svelte';
	import { seasonStatus, telHref, type Shell } from '../shell';

	let { shell }: { shell: Shell } = $props();
	const status = seasonStatus();
</script>

<footer data-tone="slate" class="on-dark">
	<div class="container">
		<div class="row">
			<p class="lead">{shell.footerText || shell.tagline}</p>
			<div class="meta">
				{#if shell.contact.address}<address>{shell.contact.address}</address>{/if}
				{#if shell.contact.phone}<Link href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
				{#if shell.contact.email}<Link href={`mailto:${shell.contact.email}`}>{shell.contact.email}</Link>{/if}
				<p class="small">{status.text}</p>
			</div>
		</div>
		<p class="board" aria-hidden="true">{shell.siteName}</p>
		<div class="legal small">
			{#each shell.nav as item (item.id)}<Link href={item.href}>{item.label}</Link>{/each}
			{#each shell.legal as doc (doc.slug)}<Link href={`/legal/${doc.slug}`}>{doc.title}</Link>{/each}
			{#each shell.social as s (s.id)}<Link href={s.url}>{s.label}</Link>{/each}
			<Link href="/credits">Photo credits</Link>
			<span>© {new Date().getFullYear()} {shell.siteName}. A demo hotel: not a real business.</span>
		</div>
	</div>
</footer>

<style>
	footer {
		padding-block: var(--section) var(--s-5);
		margin-top: var(--section);
		overflow: hidden;
	}
	.row {
		display: grid;
		gap: var(--s-6);
	}
	.meta {
		display: flex;
		flex-direction: column;
	}
	.meta :global(a),
	.legal :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
	address {
		font-style: normal;
		white-space: pre-line;
		margin-bottom: var(--s-2);
	}
	.board {
		font: 700 17vw/0.82 var(--font-display);
		text-transform: uppercase;
		letter-spacing: -0.02em;
		color: var(--apricot);
		margin: var(--s-7) 0 var(--s-5) -0.04em;
		white-space: nowrap;
	}
	.legal {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
		align-items: center;
	}
	.legal span {
		flex-basis: 100%;
	}
	@media (min-width: 56rem) {
		.row {
			grid-template-columns: 1.4fr 1fr;
		}
		.legal span {
			flex-basis: auto;
			margin-left: auto;
		}
	}
	@media (max-width: 56rem) {
		footer {
			padding-bottom: 6rem;
		}
	}
</style>
