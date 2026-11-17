<script lang="ts">
	import { useRelation, type DocPreviewProps } from '@kitcms/ui';

	let { doc }: DocPreviewProps = $props();
	const logo = useRelation('media', () => doc.logo as string | null | undefined);
	const nav = $derived((doc.nav ?? []) as { id?: string; label?: string }[]);
</script>

<header>
	{#if logo.current?.url}<img src={logo.current.url} alt={logo.current.title} />{/if}
	<strong>{doc.siteName as string}</strong>
	<nav>
		{#each nav as item, i (item.id ?? i)}<span>{item.label}</span>{/each}
	</nav>
</header>
{#if doc.tagline}<p class="tagline">{doc.tagline as string}</p>{/if}

<style>
	header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #ddd;
	}
	img {
		height: 28px;
		width: auto;
	}
	nav {
		display: flex;
		gap: 0.75rem;
		margin-left: auto;
	}
	.tagline {
		margin: 0;
		padding: 1rem;
		color: #555;
	}
</style>
