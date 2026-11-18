<script lang="ts">
	// Directory: four columns on an earth field: stay, explore, visit, hotel.
	import Link from '../Link.svelte';
	import { seasonStatus, telHref, waHref, type Shell } from '../shell';

	let { shell }: { shell: Shell } = $props();
	const status = seasonStatus();
	const stay = [
		{ label: 'Rooms', href: '/rooms' },
		{ label: 'Dining', href: '/dining' },
		{ label: 'Contact', href: '/contact' },
	];
	const explore = [
		{ label: 'Experiences', href: '/experiences' },
		{ label: 'Journal', href: '/journal' },
		{ label: 'Gallery', href: '/gallery' },
	];
</script>

<footer data-tone="earth">
	<div class="container">
		<div class="grid">
			<div class="intro">
				<p class="name">{shell.siteName}</p>
				{#if shell.footerText}<p>{shell.footerText}</p>{/if}
			</div>
			<nav aria-label="Stay">
				<h2>Stay</h2>
				{#each stay as { label, href } (href)}<Link {href}>{label}</Link>{/each}
			</nav>
			<nav aria-label="Explore">
				<h2>Explore</h2>
				{#each explore as { label, href } (href)}<Link {href}>{label}</Link>{/each}
			</nav>
			<div>
				<h2>Visit</h2>
				{#if shell.contact.address}<address>{shell.contact.address}</address>{/if}
				{#if shell.contact.phone}<Link href={telHref(shell.contact.phone)}>{shell.contact.phone}</Link>{/if}
				{#if shell.contact.whatsapp}<Link href={waHref(shell.contact.whatsapp)}>WhatsApp</Link>{/if}
				{#if shell.contact.email}<Link href={`mailto:${shell.contact.email}`}>{shell.contact.email}</Link>{/if}
				<p class="small">{status.text}</p>
			</div>
		</div>
		<div class="legal small">
			{#each shell.legal as doc (doc.slug)}<Link href={`/legal/${doc.slug}`}>{doc.title}</Link>{/each}
			{#each shell.social as s (s.id)}<Link href={s.url}>{s.label}</Link>{/each}
			<Link href="/credits">Photo credits</Link>
			<span>© {new Date().getFullYear()} {shell.siteName}. A demo hotel: not a real business.</span>
		</div>
	</div>
</footer>

<style>
	footer {
		padding-block: var(--section) var(--s-6);
		margin-top: var(--section);
	}
	.grid {
		display: grid;
		gap: var(--s-7) var(--s-6);
		grid-template-columns: 1fr 1fr;
	}
	.intro {
		grid-column: 1 / -1;
		max-width: 34ch;
	}
	.name {
		font: 700 clamp(2.5rem, 1.5rem + 4vw, 4rem) / 0.95 var(--font-display);
		text-transform: uppercase;
		margin-bottom: var(--s-3);
	}
	h2 {
		font: 700 1.5rem/1 var(--font-display);
		text-transform: uppercase;
		margin-bottom: var(--s-3);
		color: var(--apricot);
	}
	nav,
	.grid > div:last-child {
		display: flex;
		flex-direction: column;
	}
	.grid :global(a),
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
	.legal {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
		margin-top: var(--s-7);
		align-items: center;
	}
	.legal span {
		flex-basis: 100%;
	}
	@media (min-width: 56rem) {
		.grid {
			grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
		}
		.intro {
			grid-column: auto;
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
