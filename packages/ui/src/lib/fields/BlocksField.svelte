<script lang="ts">
	// Blocks: an ordered list of rows, each one of the block types the config allows. Like
	// ArrayField, rows render in array order with their CURRENT index in every input name.
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

	let { field, path, value = $bindable() }: FieldProps<FieldOf<'blocks', 'client'>> = $props();

	const ctx = getFormContext();
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);

	if (!Array.isArray(value)) value = [];
	const rows = $derived(value as Row[]);

	const blockBySlug = $derived(new Map(field.blocks.map((b) => [b.slug, b])));
	const full = $derived(field.maxRows !== undefined && rows.length >= field.maxRows);
	const atMin = $derived(field.minRows !== undefined && rows.length <= field.minRows);

	let collapsed = $state<Record<string, boolean>>({});
	/** Which "add block" menu is open: the insert index after a row (1..n), or -1 for the one at the end. */
	let menuAt = $state<number | null>(null);
	let root: HTMLElement | undefined = $state();
	let addButton: HTMLButtonElement | undefined = $state();

	const rowKey = (row: Row, i: number) => (typeof row.id === 'string' && row.id ? row.id : `#${i}`);
	const hasError = (i: number) => Object.keys(ctx.errors).some((k) => k.startsWith(`${path}.${i}.`));

	async function focusRow(id: string) {
		await tick();
		root?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"] [data-row-focus]`)?.focus();
	}

	function insert(slug: string, at: number) {
		const block = blockBySlug.get(slug);
		menuAt = null;
		if (!block || full || readOnly) return;
		const row = emptyRow(block.fields, { blockType: slug });
		value = [...rows.slice(0, at), row, ...rows.slice(at)];
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
	function menuKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			menuAt = null;
			addButton?.focus();
		}
	}

	const drag = new RowDrag(move);
</script>

{#snippet menu(at: number)}
	<ul class="kc-block-menu kc-card" role="menu" aria-label="Choose a block" onkeydown={menuKeydown}>
		{#each field.blocks as block (block.slug)}
			<li role="none">
				<button type="button" role="menuitem" class="kc-btn kc-btn--ghost" onclick={() => insert(block.slug, at)}>
					<span>{block.labels.singular}</span>
					<span class="kc-muted kc-block-menu__slug">{block.slug}</span>
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

<FieldShell {field} {path} as="fieldset">
	<div class="kc-rows" bind:this={root}>
		<input type="hidden" name={FORM.marker(path)} value="1" disabled={readOnly} />
		{#if field.minRows !== undefined || field.maxRows !== undefined}
			<p class="kc-muted kc-rows__hint">
				{rows.length}
				{rows.length === 1 ? 'block' : 'blocks'}{#if field.minRows !== undefined}, min {field.minRows}{/if}{#if field.maxRows !== undefined},
					max {field.maxRows}{/if}
			</p>
		{/if}
		{#each rows as row, i (rowKey(row, i))}
			{@const rowPath = `${path}.${i}`}
			{@const slug = typeof row.blockType === 'string' ? row.blockType : ''}
			{@const block = blockBySlug.get(slug)}
			<RowCard
				index={i}
				rowId={rowKey(row, i)}
				title={block ? block.labels.singular : `Unknown block "${slug}"`}
				subtitle={block ? rowSummary(block.fields, row) : ''}
				collapsed={collapsed[rowKey(row, i)] === true}
				hasError={hasError(i)}
				{readOnly}
				count={rows.length}
				canDuplicate={!full && block !== undefined}
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
				{#snippet actions()}
					{#if !full}
						<button
							type="button"
							class="kc-btn kc-btn--ghost"
							aria-label="Insert a block after row {i + 1}"
							aria-haspopup="menu"
							aria-expanded={menuAt === i + 1}
							onclick={() => (menuAt = menuAt === i + 1 ? null : i + 1)}>Insert after</button
						>
					{/if}
				{/snippet}
				<input type="hidden" name="{rowPath}.id" value={typeof row.id === 'string' ? row.id : ''} />
				<input type="hidden" name="{rowPath}.blockType" value={slug} />
				{#if block}
					<RenderFields
						fields={block.fields}
						layout={block.layout}
						bind:values={() => rows[i]!, (v) => (rows[i] = v)}
						prefix={rowPath}
					/>
				{:else}
					<p class="kc-alert" role="alert">
						This block type ("{slug}") is no longer in the config. Its content can't be edited here and is
						dropped when you save, unless you remove the row first or restore the block.
					</p>
				{/if}
			</RowCard>
			{#if menuAt === i + 1}{@render menu(i + 1)}{/if}
		{/each}
		{#if !readOnly}
			<div class="kc-block-add">
				<button
					type="button"
					class="kc-btn"
					bind:this={addButton}
					disabled={full}
					aria-haspopup="menu"
					aria-expanded={menuAt === -1}
					onclick={() => (menuAt = menuAt === -1 ? null : -1)}>Add block</button
				>
				{#if menuAt === -1}{@render menu(rows.length)}{/if}
			</div>
		{/if}
	</div>
</FieldShell>

<style>
	.kc-rows {
		display: grid;
		gap: 0.75rem;
		min-width: 0;
	}
	.kc-rows__hint {
		margin: 0;
		font-size: 0.8125rem;
	}
	.kc-block-add {
		display: grid;
		gap: 0.5rem;
		justify-items: start;
	}
	.kc-block-menu {
		list-style: none;
		margin: 0;
		padding: 0.25rem;
		display: grid;
		gap: 0.125rem;
		min-width: 14rem;
	}
	.kc-block-menu button {
		width: 100%;
		justify-content: space-between;
		display: flex;
		gap: 1rem;
	}
	.kc-block-menu__slug {
		font-size: 0.75rem;
	}
</style>
