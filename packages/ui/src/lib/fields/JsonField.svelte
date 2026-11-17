<script lang="ts">
	// Arbitrary JSON, edited as text. The textarea submits the raw text (the server parses it and
	// reports invalid JSON as a field error, see core admin/form.ts). The form state holds the
	// parsed value; while the text doesn't parse, the last valid value is kept and a hint is shown.
	import { untrack } from 'svelte';
	import type { FieldOf } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import { fieldId, type FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'json', 'client'>> = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);

	const format = (v: unknown) => (v === null || v === undefined ? '' : JSON.stringify(v, null, 2));
	// Seeded once at creation (runs during SSR); the edit view re-creates fields per document.
	let text = $state(untrack(() => format(value)));
	let invalid = $state(false);

	const describedBy = $derived(
		[
			field.admin.description && `${id}-desc`,
			ctx.errors[path] && `${id}-err`,
			invalid && `${id}-json`,
		]
			.filter(Boolean)
			.join(' ') || undefined,
	);

	function oninput() {
		if (text.trim() === '') {
			value = null;
			invalid = false;
			return;
		}
		try {
			value = JSON.parse(text) as unknown;
			invalid = false;
		} catch {
			invalid = true;
		}
	}
</script>

<FieldShell {field} {path}>
	<textarea
		{id}
		class="kc-input kc-json"
		name={path}
		rows={field.admin.rows ?? 6}
		spellcheck="false"
		bind:value={text}
		{oninput}
		placeholder={field.admin.placeholder}
		disabled={readOnly}
		aria-invalid={invalid || ctx.errors[path] ? 'true' : undefined}
		aria-describedby={describedBy}
	></textarea>
	{#if invalid}<p class="kc-json__hint" id="{id}-json">Not valid JSON yet.</p>{/if}
</FieldShell>

<style>
	.kc-json {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.8125rem;
	}
	.kc-json__hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--kc-danger);
	}
</style>
