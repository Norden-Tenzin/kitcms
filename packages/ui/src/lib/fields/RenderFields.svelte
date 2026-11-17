<script lang="ts">
	// Renders one container's fields (a collection, a group, an array row or a block) by walking its
	// admin layout tree. `values` is the container's object inside the form state; fields bind to
	// `values[field.name]`. `prefix` is the container's dot path ('' at the document root).
	import type { ClientField, LayoutNode } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import RenderNodes from './RenderNodes.svelte';

	let {
		fields,
		layout,
		values = $bindable(),
		prefix = '',
		/** Only render fields in this admin position (top level of the edit view). */
		position,
	}: {
		fields: ClientField[];
		layout: LayoutNode[];
		values: Record<string, unknown>;
		prefix?: string;
		position?: 'main' | 'sidebar';
	} = $props();

	const ctx = getFormContext();
	const byName = $derived(new Map(fields.map((f) => [f.name, f])));
	const visible = (f: ClientField) =>
		!f.admin.hidden &&
		!(prefix === '' && ctx.hidden.has(f.name)) &&
		(position === undefined || (f.admin.position ?? 'main') === position);
</script>

<RenderNodes nodes={layout} {byName} {visible} bind:values {prefix} />
