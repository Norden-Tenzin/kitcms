<script lang="ts">
	// (Core types relationship and upload as one union member, hence the combined FieldOf.)
	// Relationship: a reference (or ordered list of references) to documents of another collection.
	import type { FieldOf } from '@kitcms/core/client';
	import RelationField from './relation/RelationField.svelte';
	import type { FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'relationship' | 'upload', 'client'>> = $props();
</script>

<RelationField {field} {path} bind:value kind="relationship" />
