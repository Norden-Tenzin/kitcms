<script lang="ts">
	// URL slug. Same structure as TextField (the reference); see ./types.ts for the contract.
	// "Generate" normalizes the current text with `slugify`. The server fills an empty slug from
	// the `from` field, so an empty value is valid.
	import type { FieldOf } from '@kitcms/core/client';
	import { slugify } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import { fieldId, type FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'slug', 'client'>> = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);
	const hintId = $derived(`${id}-hint`);
	const showHint = $derived(Boolean(field.from) && (typeof value !== 'string' || value === ''));
	const describedBy = $derived(
		[field.admin.description && `${id}-desc`, showHint && hintId, ctx.errors[path] && `${id}-err`]
			.filter(Boolean)
			.join(' ') || undefined,
	);

	// The form state may hold null; the input works with strings (function binding, Svelte ≥ 5.9).
	const get = () => (typeof value === 'string' ? value : '');
	const set = (v: string) => {
		value = v === '' ? null : v;
	};

	const normalize = () => {
		const slug = slugify(typeof value === 'string' ? value : '');
		value = slug === '' ? null : slug;
	};
</script>

<FieldShell {field} {path}>
	<div class="kc-slug">
		<input
			{id}
			class="kc-input"
			type="text"
			name={path}
			bind:value={get, set}
			required={field.required}
			placeholder={field.admin.placeholder}
			disabled={readOnly}
			aria-invalid={ctx.errors[path] ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
		{#if !readOnly}
			<button type="button" class="kc-slug__generate" onclick={normalize}>Generate</button>
		{/if}
	</div>
	{#if showHint}
		<p class="kc-slug__hint" id={hintId}>Leave empty to generate from {field.from}</p>
	{/if}
</FieldShell>

<style>
	.kc-slug {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.kc-slug .kc-input {
		flex: 1;
		min-width: 0;
	}
	.kc-slug__generate {
		flex: none;
		font: inherit;
		font-size: 0.875rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--kc-border, currentColor);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--kc-text);
		cursor: pointer;
	}
	.kc-slug__hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--kc-muted);
	}
</style>
