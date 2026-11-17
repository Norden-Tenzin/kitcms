<script lang="ts">
	import { getMeta, type MetaDefaults } from '../meta';

	let { doc, url = '', defaults }: { doc: Record<string, unknown>; url?: string; defaults?: MetaDefaults } = $props();

	const TITLE_MAX = 60;
	const DESC_MAX = 160;

	const meta = $derived(getMeta(doc, defaults));
	const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
	const title = $derived(cut(meta.title, TITLE_MAX));
	const description = $derived(cut(meta.description ?? '', DESC_MAX));
	const titleOver = $derived(meta.title.length > TITLE_MAX);
	const descOver = $derived((meta.description ?? '').length > DESC_MAX);
</script>

<div class="serp">
	<div class="serp-url">{url}</div>
	<div class="serp-title">{title || 'Untitled'}</div>
	{#if description}<div class="serp-desc">{description}</div>{/if}
	{#if titleOver || descOver}
		<p class="serp-hint">
			{#if titleOver}The title is over the recommended length ({TITLE_MAX}) and may be cut off. {/if}
			{#if descOver}The description is over the recommended length ({DESC_MAX}) and may be cut off.{/if}
		</p>
	{/if}
</div>

<style>
	.serp {
		font-family: Arial, sans-serif;
		max-width: 600px;
		padding: 12px 16px;
		background: #fff;
		color: #4d5156;
		border: 1px solid #dadce0;
		border-radius: 8px;
	}
	.serp-url {
		font-size: 12px;
		line-height: 1.4;
		color: #202124;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.serp-title {
		font-size: 20px;
		line-height: 1.3;
		color: #1a0dab;
		margin: 2px 0;
	}
	.serp-desc {
		font-size: 14px;
		line-height: 1.58;
	}
	.serp-hint {
		margin: 8px 0 0;
		font-size: 12px;
		color: #b3261e;
	}
</style>
