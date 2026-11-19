<script lang="ts">
	import type { AdminDataOf } from '@kitcms/core/client';
	import { collectionHref, createHref, globalHref } from '../links';
	import PanelBlocks from './PanelBlocks.svelte';

	let { data }: { data: AdminDataOf<'dashboard'> } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href comes from ../links, which calls resolve() -->

<h1>Dashboard</h1>
{#each data.dashboardPanels ?? [] as p (`${p.plugin}/${p.id}`)}
	<section class="dash-panel" aria-label={p.label} data-testid="dashboard-panel">
		<h2>{p.label}</h2>
		<PanelBlocks content={p.content} />
	</section>
{/each}
<div class="grid">
	{#each data.collections as c (c.slug)}
		<section class="kc-card">
			<h2><a href={collectionHref(c.slug)}>{c.label}</a></h2>
			{#if c.description}<p class="kc-muted">{c.description}</p>{/if}
			{#if c.totalDocs !== -1}
				<p class="count">{c.totalDocs} {c.totalDocs === 1 ? 'document' : 'documents'}</p>
			{/if}
			<a class="kc-btn" href={createHref(c.slug)}>Create</a>
		</section>
	{/each}
	{#each data.globals as g (g.slug)}
		<section class="kc-card" data-testid="global-card">
			<h2><a href={globalHref(g.slug)}>{g.label}</a></h2>
			{#if g.description}<p class="kc-muted">{g.description}</p>{/if}
			<p class="kc-muted">Global</p>
			<a class="kc-btn" href={globalHref(g.slug)}>Edit</a>
		</section>
	{/each}
</div>

<style>
	.dash-panel {
		margin-top: 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}
	section {
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}
	section a.kc-btn {
		justify-self: start;
	}
	h2 {
		font-size: 1.05rem;
	}
	h2 a {
		text-decoration: none;
		color: inherit;
	}
	h2 a:hover {
		text-decoration: underline;
	}
	p {
		margin: 0;
	}
	.count {
		font-size: 1.25rem;
		font-weight: 600;
	}
</style>
