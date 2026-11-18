<script lang="ts">
	// Hearth: calm, two columns on a surface field. Name and welcome left; where, when and links right.
	import Link from '../Link.svelte';
	import { seasonStatus, telHref, waHref, type Shell } from '../shell';

	let { shell }: { shell: Shell } = $props();
	const status = seasonStatus();
</script>

<footer data-tone="surface">
	<div class="container grid">
		<div class="who">
			<p class="name">{shell.siteName}</p>
			{#if shell.footerText}<p class="lead">{shell.footerText}</p>{/if}
			<p class="status small"><span class="dot" class:open={status.open}></span>{status.text}</p>
		</div>
		<div class="col">
			{#if shell.contact.address}<address>{shell.contact.address}</address>{/if}
			<p>
				{#if shell.contact.phone}<Link href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
				{#if shell.contact.whatsapp}<Link href={waHref(shell.contact.whatsapp)}>WhatsApp</Link>{/if}
				{#if shell.contact.email}<Link href={`mailto:${shell.contact.email}`}>{shell.contact.email}</Link>{/if}
			</p>
			{#if shell.season}<p class="small">{shell.season}</p>{/if}
			{#if shell.checkIn}<p class="small">Check-in {shell.checkIn}, check-out {shell.checkOut}</p>{/if}
		</div>
		<nav aria-label="Footer" class="links">
			{#each shell.nav as item (item.id)}<Link href={item.href}>{item.label}</Link>{/each}
			{#each shell.social as s (s.id)}<Link href={s.url}>{s.label}</Link>{/each}
		</nav>
	</div>
	<div class="container legal small">
		{#each shell.legal as doc (doc.slug)}<Link href={`/legal/${doc.slug}`}>{doc.title}</Link>{/each}
		<Link href="/credits">Photo credits</Link>
		<span>© {new Date().getFullYear()} {shell.siteName}. A demo hotel: not a real business.</span>
	</div>
</footer>

<style>
	footer {
		padding-block: var(--section) var(--s-6);
		margin-top: var(--section);
	}
	.grid {
		display: grid;
		gap: var(--s-7);
	}
	.name {
		font: 700 clamp(2.5rem, 1.5rem + 4vw, 4rem) / 0.95 var(--font-display);
		text-transform: uppercase;
		margin-bottom: var(--s-4);
	}
	.status {
		margin-top: var(--s-4);
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.dot {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--flag);
	}
	.dot.open {
		background: var(--accent);
	}
	address {
		font-style: normal;
		white-space: pre-line;
		margin-bottom: var(--s-3);
	}
	.col p {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
		margin-bottom: var(--s-2);
	}
	.col :global(a),
	.links :global(a),
	.legal :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
		align-content: start;
	}
	.legal {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
		margin-top: var(--s-7);
		align-items: center;
	}
	.legal span {
		margin-left: auto;
	}
	@media (min-width: 56rem) {
		.grid {
			grid-template-columns: 1.3fr 1fr 0.8fr;
			gap: var(--s-7);
		}
		.links {
			flex-direction: column;
		}
	}
	@media (max-width: 56rem) {
		footer {
			padding-bottom: 6rem; /* room for the sticky mobile bar */
		}
		.legal span {
			margin-left: 0;
			flex-basis: 100%;
		}
	}
</style>
