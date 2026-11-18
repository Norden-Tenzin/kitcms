<script lang="ts">
	// Plain share links: no third-party scripts, nothing loaded until a link is followed.
	interface Props {
		url: string;
		title: string;
		/** Heading text; the list is labelled with it. */
		label?: string;
	}
	let { url, title, label = 'Share this note' }: Props = $props();
	const u = $derived(encodeURIComponent(url));
	const t = $derived(encodeURIComponent(title));
	const links = $derived([
		{ name: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
		{ name: 'Email', href: `mailto:?subject=${t}&body=${u}` },
		{ name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
		{ name: 'X', href: `https://x.com/intent/post?text=${t}&url=${u}` },
	]);
</script>

<!-- Internal links and anchors are plain paths built here, not routes to resolve. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<nav aria-label={label} class="share">
	<p class="small">{label}</p>
	<ul>
		{#each links as l (l.name)}
			<li><a href={l.href} target={l.name === 'Email' ? undefined : '_blank'} rel="noopener noreferrer">{l.name}<span class="sr-only"> (opens in a new tab)</span></a></li>
		{/each}
	</ul>
</nav>

<style>
	.share {
		display: grid;
		gap: var(--s-1);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 600;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.25em;
	}
</style>
