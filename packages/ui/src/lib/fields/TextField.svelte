<script lang="ts">
	// THE REFERENCE FIELD COMPONENT. Simple field components (textarea, number, email, slug, date,
	// select, checkbox) follow this file's structure. See ./types.ts for the contract.
	import type { FieldOf } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import { fieldId, type FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'text', 'client'>> = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);
	const describedBy = $derived(
		[field.admin.description && `${id}-desc`, ctx.errors[path] && `${id}-err`].filter(Boolean).join(' ') ||
			undefined,
	);

	// The form state may hold null; the input works with strings (function binding, Svelte ≥ 5.9).
	const get = () => (typeof value === 'string' ? value : '');
	const set = (v: string) => {
		value = v === '' ? null : v;
	};
</script>

<FieldShell {field} {path}>
	<input
		{id}
		class="kc-input"
		type="text"
		name={path}
		bind:value={get, set}
		required={field.required}
		minlength={field.minLength}
		maxlength={field.maxLength}
		placeholder={field.admin.placeholder}
		disabled={readOnly}
		aria-invalid={ctx.errors[path] ? 'true' : undefined}
		aria-describedby={describedBy}
	/>
</FieldShell>
