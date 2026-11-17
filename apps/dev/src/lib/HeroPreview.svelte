<script lang="ts">
	import { useRelation, type BlockPreviewProps } from '@kitcms/ui';

	let { block }: BlockPreviewProps = $props();
	const image = useRelation('media', () => block.image as string | null | undefined);
</script>

<section class="hero">
	{#if image.current?.url}<img src={image.current.url} alt={image.current.title} />{/if}
	<h1>{block.heading as string}</h1>
	{#if block.subheading}<p>{block.subheading as string}</p>{/if}
</section>

<style>
	.hero {
		padding: 2rem 1.25rem;
		text-align: center;
	}
	img {
		max-width: 100%;
		max-height: 14rem;
		object-fit: cover;
		border-radius: 8px;
	}
	h1 {
		margin: 0.5rem 0 0;
		font-size: 2rem;
	}
	p {
		margin: 0.5rem 0 0;
		color: #555;
	}
</style>
