<script lang="ts">
	import Link from '#lib/site/Link.svelte';

	let { data } = $props();
</script>

<h1>Fields</h1>
<p>Published "Every field" documents. Each page renders every field type of one document.</p>

{#if data.docs.length}
	<ul class="plain">
		{#each data.docs as d (d.id)}
			<li><Link href={`/lab/fields/${d.slug}`}>{d.title}</Link></li>
		{/each}
	</ul>
{:else}
	<p class="muted">No published documents yet. Create one in the admin (Lab, Every field) or run the seed.</p>
{/if}
