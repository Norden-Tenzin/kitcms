<script lang="ts">
	import PageHead from '#lib/site/PageHead.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
</script>

<Seo title="Photo credits" siteName={data.site.siteName} />
<PageHead title="Photo credits" lead="Dolkar House is a demo hotel. The pictures show Leh and Ladakh, not the demo hotel, and are used under open licences." />
<div class="container">
	<ul>
		{#each data.credits as m (m.id)}
			<li><span>{m.alt}</span> <span class="small">{m.credit}</span></li>
		{/each}
	</ul>
</div>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: var(--s-5) 0 0;
		display: grid;
		gap: var(--s-4);
	}
	li {
		display: grid;
		gap: 0;
	}
</style>
