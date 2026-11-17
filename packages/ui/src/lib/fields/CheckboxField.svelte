<script lang="ts">
	// Boolean checkbox. Same structure as TextField (the reference); see ./types.ts for the contract.
	// The hidden presence marker makes "unchecked" submit a value (an unchecked box submits nothing).
	import type { FieldOf } from '@kitcms/core/client';
	import { FORM } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import { fieldId, type FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'checkbox', 'client'>> = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);
	const describedBy = $derived(
		[field.admin.description && `${id}-desc`, ctx.errors[path] && `${id}-err`].filter(Boolean).join(' ') ||
			undefined,
	);

	// null/undefined is unchecked.
	const get = () => value === true;
	const set = (v: boolean) => {
		value = v;
	};
</script>

<FieldShell {field} {path} as="div">
	<input type="hidden" name={FORM.marker(path)} value="1" disabled={readOnly} />
	<div class="kc-check">
		<input
			{id}
			type="checkbox"
			name={path}
			bind:checked={get, set}
			disabled={readOnly}
			aria-invalid={ctx.errors[path] ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
	</div>
</FieldShell>

<style>
	.kc-check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
