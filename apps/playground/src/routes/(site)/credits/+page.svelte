<script lang="ts">
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
</script>

<Seo title="Photo credits" siteName={data.site.siteName} />
<div class="container wrap">
	<h1>Photo credits</h1>
	<p class="lead muted">
		Halden Studio is a demo studio. The pictures show workspaces, type, objects and Bengaluru, not the studio's own work, and are used under open licences.
	</p>
	<ul>
		{#each data.credits as m (m.id)}
			<li><span>{m.alt}</span> <span class="small muted">{m.credit}</span></li>
		{/each}
	</ul>
</div>

<style>
	.wrap {
		display: grid;
		gap: var(--s-4);
		padding-block: var(--s-5) var(--section);
	}
	h1 {
		font-size: var(--step-h2);
	}
	ul {
		list-style: none;
		display: grid;
		gap: var(--s-4);
		margin-top: var(--s-3);
	}
	li {
		display: grid;
	}
</style>
