<script lang="ts">
	// The admin's live preview of the `site` global: the header with the current name, logo, navigation
	// and button, and the tagline. The real header designs are separate components; this stays simple.
	import { useRelation, type DocPreviewProps } from '@kitcms/ui';

	let { doc }: DocPreviewProps = $props();
	const logo = useRelation('media', () => doc.logo as string | null | undefined);
	const nav = $derived((doc.nav ?? []) as { id?: string; label?: string }[]);
	const cta = $derived((doc.cta ?? {}) as { label?: string });
</script>

<div class="site-preview">
	<header>
		{#if logo.current?.url}<img src={logo.current.url} alt={logo.current.title} />{/if}
		<strong class="name">{(doc.siteName as string) || 'Site name'}</strong>
		<nav>
			{#each nav as item, i (item.id ?? i)}<span>{item.label}</span>{/each}
			{#if cta.label}<span class="cta">{cta.label}</span>{/if}
		</nav>
	</header>
	{#if doc.tagline}<p class="tagline">{doc.tagline as string}</p>{/if}
</div>

<style>
	.site-preview {
		background: #f6f5f1;
		color: #161716;
		font-family: system-ui, sans-serif;
	}
	header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		padding: 0.75rem 1rem;
	}
	img {
		height: 28px;
		width: auto;
	}
	.name {
		font: 1.5rem/1 'Instrument Serif', Georgia, serif;
		font-weight: 400;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		margin-left: auto;
		font-size: 0.9rem;
	}
	.cta {
		padding: 0.15rem 0.6rem;
		background: #2f5d50;
		color: #fff;
	}
	.tagline {
		margin: 0;
		padding: 0.5rem 1rem 1rem;
		color: #555;
	}
</style>
