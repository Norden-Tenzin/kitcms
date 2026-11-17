<script lang="ts">
	// Group: a named object of sub-fields, submitted as `path.child` inputs.
	import type { FieldOf } from '@kitcms/core/client';
	import { FORM } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import RenderFields from './RenderFields.svelte';
	import type { FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'group', 'client'>> = $props();

	const ctx = getFormContext();
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);

	// RenderFields binds into an object, so make sure there is one (synchronously, so SSR has it too).
	if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) value = {};
	const get = () => value as Record<string, unknown>;
	const set = (v: Record<string, unknown>) => {
		value = v;
	};
</script>

<FieldShell {field} {path} as="fieldset">
	<!-- A disabled fieldset disables every descendant control (marker included), so a read-only
	     group submits nothing and the stored value is kept. -->
	<fieldset class="kc-group" disabled={readOnly}>
		<input type="hidden" name={FORM.marker(path)} value="1" />
		<RenderFields fields={field.fields} layout={field.layout} bind:values={get, set} prefix={path} />
	</fieldset>
</FieldShell>

<style>
	.kc-group {
		display: grid;
		gap: 1rem;
		padding: 0.75rem;
		border: 1px solid var(--kc-border);
		border-radius: var(--kc-radius);
	}
</style>
