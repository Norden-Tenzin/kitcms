<script lang="ts">
	import Link from '#lib/site/Link.svelte';

	let { data } = $props();
	const publishedIds = $derived(new Set(data.published.map((p) => p.id)));
</script>

<h1>Drafts</h1>
<p>
	Pages have drafts and autosave. Visitors only ever see the published state; a draft read is refused for them.
</p>

<h2>What a visitor sees ({data.published.length})</h2>
{#if data.published.length}
	<ul>
		{#each data.published as p (p.id)}<li>{p.title}</li>{/each}
	</ul>
{:else}
	<p class="muted">No published pages.</p>
{/if}

<h2>With drafts included</h2>
{#if data.all}
	<ul>
		{#each data.all as p (p.id)}
			<li>{p.title} <span class="muted">({publishedIds.has(p.id) ? 'published' : 'not visible to visitors'}, {p.status})</span></li>
		{/each}
	</ul>
{:else}
	<p class="muted">
		{data.refused ? 'Refused: reading drafts needs a signed-in user, and public pages never act as one.' : 'Not available.'} Editors see drafts in the <Link href="/admin">admin</Link>.
	</p>
{/if}
