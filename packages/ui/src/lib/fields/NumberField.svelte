<script lang="ts">
	// Number input. Same structure as TextField (the reference); see ./types.ts for the contract.
	// The input works with strings: `''` is null. A value that doesn't parse is kept as the raw
	// string so the server's validation reports it instead of the field silently clearing.
	import type { FieldOf } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import { fieldId, type FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'number', 'client'>> = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);
	const describedBy = $derived(
		[field.admin.description && `${id}-desc`, ctx.errors[path] && `${id}-err`].filter(Boolean).join(' ') ||
			undefined,
	);

	const get = () => {
		if (typeof value === 'number') return String(value);
		if (typeof value === 'string') return value;
		return '';
	};
	const set = (v: string) => {
		if (v === '') {
			value = null;
			return;
		}
		const n = Number(v);
		value = Number.isNaN(n) ? v : n;
	};
</script>

<FieldShell {field} {path}>
	<input
		{id}
		class="kc-input"
		type="number"
		name={path}
		min={field.min}
		max={field.max}
		step={field.admin.step ?? (field.integer ? 1 : 'any')}
		bind:value={get, set}
		required={field.required}
		placeholder={field.admin.placeholder}
		disabled={readOnly}
		aria-invalid={ctx.errors[path] ? 'true' : undefined}
		aria-describedby={describedBy}
	/>
</FieldShell>
