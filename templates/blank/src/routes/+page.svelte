<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<h1>__APP_NAME__</h1>
<p><a href={resolve('/(kitcms)/admin/[...path]', { path: '' })}>Admin</a></p>
<h2>Published pages</h2>
<ul>
	{#each data.pages as page (page.id)}
		<li>
			<strong>{page.title}</strong> <code>/{page.slug}</code>
			{#if page.body}<p>{page.body}</p>{/if}
		</li>
	{:else}
		<li>No published pages yet.</li>
	{/each}
</ul>
