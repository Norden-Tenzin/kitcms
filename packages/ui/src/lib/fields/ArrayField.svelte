<script lang="ts">
	// Array: repeatable rows of sub-fields. The server reads rows in DOM order, so rows render in
	// array order and use their CURRENT index in every name; reordering the state re-renders names.
	import { tick } from 'svelte';
	import type { FieldOf } from '@kitcms/core/client';
	import { FORM } from '@kitcms/core/client';
	import { getFormContext } from '../form/context';
	import FieldShell from './FieldShell.svelte';
	import RenderFields from './RenderFields.svelte';
	import RowCard from './RowCard.svelte';
	import { RowDrag } from './rowDrag.svelte';
	import { cloneRow, emptyRow, moveItem, rowSummary, type Row } from './rows';
	import type { FieldProps } from './types';

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'array', 'client'>> = $props();

	const ctx = getFormContext();
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);

	if (!Array.isArray(value)) value = [];
	const rows = $derived(value as Row[]);

	const label = $derived(field.labels.singular);
	const full = $derived(field.maxRows !== undefined && rows.length >= field.maxRows);
	const atMin = $derived(field.minRows !== undefined && rows.length <= field.minRows);

	let collapsed = $state<Record<string, boolean>>({});
	let root: HTMLElement | undefined = $state();
	let addButton: HTMLButtonElement | undefined = $state();

	const rowKey = (row: Row, i: number) => (typeof row.id === 'string' && row.id ? row.id : `#${i}`);
	const hasError = (i: number) => Object.keys(ctx.errors).some((k) => k.startsWith(`${path}.${i}.`));

	async function focusRow(id: string) {
		await tick();
		root?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"] [data-row-focus]`)?.focus();
	}

	function add() {
		if (full || readOnly) return;
		const row = emptyRow(field.fields);
		value = [...rows, row];
		void focusRow(row.id as string);
	}
	function move(from: number, to: number) {
		value = moveItem(rows, from, to);
	}
	function duplicate(i: number) {
		if (full) return;
		const copy = cloneRow($state.snapshot(rows[i]!) as Row);
		value = [...rows.slice(0, i + 1), copy, ...rows.slice(i + 1)];
		void focusRow(copy.id as string);
	}
	async function remove(i: number) {
		if (atMin) return;
		value = rows.filter((_, j) => j !== i);
		await tick();
		addButton?.focus();
	}

	const drag = new RowDrag(move);
</script>

<FieldShell {field} {path} as="fieldset">
	<div class="kc-rows" bind:this={root}>
		<input type="hidden" name={FORM.marker(path)} value="1" disabled={readOnly} />
		{#if field.minRows !== undefined || field.maxRows !== undefined}
			<p class="kc-muted kc-rows__hint">
				{rows.length}
				{rows.length === 1 ? 'row' : 'rows'}{#if field.minRows !== undefined}, min {field.minRows}{/if}{#if field.maxRows !== undefined},
					max {field.maxRows}{/if}
			</p>
		{/if}
		{#each rows as row, i (rowKey(row, i))}
			{@const rowPath = `${path}.${i}`}
			{@const summary = rowSummary(field.fields, row)}
			<RowCard
				index={i}
				rowId={rowKey(row, i)}
				title="{label} {i + 1}"
				subtitle={summary}
				collapsed={collapsed[rowKey(row, i)] === true}
				hasError={hasError(i)}
				{readOnly}
				count={rows.length}
				canDuplicate={!full}
				dragging={drag.from === i}
				dropTarget={drag.over === i && drag.from !== i}
				ontoggle={() => (collapsed[rowKey(row, i)] = !collapsed[rowKey(row, i)])}
				onmove={(d) => move(i, i + d)}
				onduplicate={() => duplicate(i)}
				onremove={() => remove(i)}
				ondragstart={(e) => drag.start(i, e)}
				ondragend={drag.end}
				ondragover={(e) => drag.dragover(i, e)}
				ondrop={(e) => drag.drop(i, e)}
			>
				<input type="hidden" name="{rowPath}.id" value={typeof row.id === 'string' ? row.id : ''} />
				<RenderFields
					fields={field.fields}
					layout={field.layout}
					bind:values={() => rows[i]!, (v) => (rows[i] = v)}
					prefix={rowPath}
				/>
			</RowCard>
		{/each}
		{#if !readOnly}
			<div>
				<button
					type="button"
					class="kc-btn"
					bind:this={addButton}
					disabled={full}
					onclick={add}>Add {label}</button
				>
			</div>
		{/if}
	</div>
</FieldShell>

<style>
	.kc-rows {
		display: grid;
		gap: 0.75rem;
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.kc-rows__hint {
		margin: 0;
		font-size: 0.8125rem;
	}
</style>
