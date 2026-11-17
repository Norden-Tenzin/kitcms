<script lang="ts">
	// Upload: a reference (or ordered list) to documents of an upload collection, shown with thumbnails.
	// Besides the search combobox, "Browse library" opens the media picker modal.
	import type { FieldOf } from '@kitcms/core/client';
	import MediaPicker from '../media/MediaPicker.svelte';
	import RelationField from './relation/RelationField.svelte';
	import type { FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'relationship' | 'upload', 'client'>> = $props();

	let open = $state(false);
</script>

<RelationField {field} {path} bind:value kind="upload">
	{#snippet browse({ select, disabled, selectedIds })}
		<button type="button" class="kc-btn" {disabled} onclick={() => (open = true)}>Browse library</button>
		<MediaPicker
			bind:open
			collection={field.relationTo}
			multiple={field.hasMany}
			max={field.hasMany ? field.maxRows : undefined}
			{selectedIds}
			onselect={(picked) => picked.forEach(select)}
		/>
	{/snippet}
</RelationField>
