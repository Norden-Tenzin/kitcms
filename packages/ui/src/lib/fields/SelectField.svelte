<script lang="ts">
	// Single choice from `field.options`. Same structure as TextField (the reference); see ./types.ts.
	// The empty option stands for "no value" (stored null) unless the field is required and set.
	import type { FieldOf } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import { fieldId, type FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'select', 'client'>> = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);
	const describedBy = $derived(
		[field.admin.description && `${id}-desc`, ctx.errors[path] && `${id}-err`].filter(Boolean).join(' ') ||
			undefined,
	);
	const showEmpty = $derived(!(field.required && typeof value === 'string' && value !== ''));

	// The form state may hold null; the select works with strings (function binding, Svelte ≥ 5.9).
	const get = () => (typeof value === 'string' ? value : '');
	const set = (v: string) => {
		value = v === '' ? null : v;
	};
</script>

<FieldShell {field} {path}>
	<select
		{id}
		class="kc-input"
		name={path}
		bind:value={get, set}
		required={field.required}
		disabled={readOnly}
		aria-invalid={ctx.errors[path] ? 'true' : undefined}
		aria-describedby={describedBy}
	>
		{#if showEmpty}<option value="">—</option>{/if}
		{#each field.options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</FieldShell>
