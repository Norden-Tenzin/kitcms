<script lang="ts">
	// SPIKE (Phase 0): form state is seeded from props once, at creation. That runs during SSR too,
	// unlike $effect. The parent re-creates this component per document with {#key}.
	import { enhance } from '$app/forms';
	import type { Doc, KitcmsCollectionMeta } from '@kitcms/core/sveltekit';
	import { untrack } from 'svelte';

	let { meta, doc }: { meta: KitcmsCollectionMeta; doc: Doc } = $props();

	const values = $state<Record<string, string>>(
		untrack(() => Object.fromEntries(meta.editable.map((f) => [f, String(doc[f] ?? '')]))),
	);
</script>

<h1>Edit: {values[meta.useAsTitle] || doc.id}</h1>
<form method="POST" action="?/save" use:enhance>
	{#each meta.editable as field (field)}
		<label>
			{field}
			<input name={field} bind:value={values[field]} />
		</label>
	{/each}
	<button>Save</button>
</form>
