<script lang="ts">
	// Label, required mark, description and error for one field. Every field component uses it.
	import type { Snippet } from 'svelte';
	import type { ClientField } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import { fieldId } from './types';

	let {
		field,
		path,
		children,
		/** `fieldset` for groups of inputs (radio-like widgets, containers); `label` wraps nothing. */
		as = 'div',
	}: { field: ClientField; path: string; children: Snippet; as?: 'div' | 'fieldset' } = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const error = $derived(ctx.errors[path]);
</script>

{#if as === 'fieldset'}
	<fieldset class="kc-field" class:kc-field--error={error} data-path={path}>
		<legend class="kc-field__label">
			{field.label}{#if field.required}<span class="kc-field__req" aria-hidden="true">*</span>{/if}
		</legend>
		{@render children()}
		{#if field.admin.description}<p class="kc-field__desc" id="{id}-desc">{field.admin.description}</p>{/if}
		{#if error}<p class="kc-field__error" id="{id}-err" role="alert">{error}</p>{/if}
	</fieldset>
{:else}
	<div class="kc-field" class:kc-field--error={error} data-path={path}>
		<label class="kc-field__label" for={id}>
			{field.label}{#if field.required}<span class="kc-field__req" aria-hidden="true">*</span>{/if}
		</label>
		{@render children()}
		{#if field.admin.description}<p class="kc-field__desc" id="{id}-desc">{field.admin.description}</p>{/if}
		{#if error}<p class="kc-field__error" id="{id}-err" role="alert">{error}</p>{/if}
	</div>
{/if}

<style>
	.kc-field {
		display: grid;
		gap: 0.375rem;
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.kc-field__label {
		font-weight: 500;
		font-size: 0.875rem;
		color: var(--kc-text);
		padding: 0;
	}
	.kc-field__req {
		color: var(--kc-danger);
		margin-left: 0.125rem;
	}
	.kc-field__desc {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--kc-muted);
	}
	.kc-field__error {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--kc-danger);
	}
</style>
