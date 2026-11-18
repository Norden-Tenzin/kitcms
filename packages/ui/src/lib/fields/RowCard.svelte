<script lang="ts">
	// One collapsible, reorderable row of an array/blocks field. The body stays in the DOM when
	// collapsed (`hidden`), so every input is still submitted.
	import type { Snippet } from 'svelte';

	let {
		index,
		rowId,
		title,
		subtitle = '',
		collapsed,
		hasError = false,
		readOnly,
		count,
		canDuplicate = true,
		dragging = false,
		dropTarget = false,
		ontoggle,
		onmove,
		onduplicate,
		onremove,
		ondragstart,
		ondragend,
		ondragover,
		ondrop,
		actions,
		children,
	}: {
		index: number;
		rowId: string;
		title: string;
		subtitle?: string;
		collapsed: boolean;
		hasError?: boolean;
		readOnly: boolean;
		count: number;
		canDuplicate?: boolean;
		dragging?: boolean;
		dropTarget?: boolean;
		ontoggle: () => void;
		onmove: (delta: -1 | 1) => void;
		onduplicate: () => void;
		onremove: () => void;
		ondragstart: (e: DragEvent) => void;
		ondragend: () => void;
		ondragover: (e: DragEvent) => void;
		ondrop: (e: DragEvent) => void;
		/** Extra header buttons (e.g. "insert block after"). */
		actions?: Snippet;
		children: Snippet;
	} = $props();

	const n = $derived(index + 1);
</script>

<div
	class="kc-card kc-row-card"
	class:kc-row-card--dragging={dragging}
	class:kc-row-card--drop={dropTarget}
	class:kc-row-card--error={hasError}
	data-row-id={rowId}
	role="group"
	aria-label="{title} {n} of {count}"
	{ondragover}
	{ondrop}
>
	<div class="kc-row-card__head">
		{#if !readOnly}
			<button
				type="button"
				class="kc-btn kc-btn--ghost kc-row-card__handle"
				draggable="true"
				aria-label="Drag to reorder row {n}"
				{ondragstart}
				{ondragend}>&#8942;&#8942;</button
			>
		{/if}
		<button
			type="button"
			class="kc-row-card__toggle"
			data-row-focus
			aria-expanded={!collapsed}
			aria-label="{collapsed ? 'Expand' : 'Collapse'} row {n}"
			onclick={ontoggle}
		>
			<span class="kc-row-card__index">{n}</span>
			<span class="kc-row-card__title">{title}</span>
			{#if subtitle}<span class="kc-muted kc-row-card__sub">{subtitle}</span>{/if}
			{#if hasError}<span class="kc-row-card__err" role="img" aria-label="This row has errors">!</span>{/if}
			<span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
		</button>
		{#if !readOnly}
			<span class="kc-row-card__tools">
				{#if actions}{@render actions()}{/if}
				<button
					type="button"
					class="kc-btn kc-btn--ghost"
					aria-label="Move row {n} up"
					disabled={index === 0}
					onclick={() => onmove(-1)}>&uarr;</button
				>
				<button
					type="button"
					class="kc-btn kc-btn--ghost"
					aria-label="Move row {n} down"
					disabled={index === count - 1}
					onclick={() => onmove(1)}>&darr;</button
				>
				{#if canDuplicate}
					<button type="button" class="kc-btn kc-btn--ghost" aria-label="Duplicate row {n}" onclick={onduplicate}
						>Duplicate</button
					>
				{/if}
				<button type="button" class="kc-btn kc-btn--ghost kc-btn--danger" aria-label="Remove row {n}" onclick={onremove}
					>Remove</button
				>
			</span>
		{/if}
	</div>
	<!-- A disabled fieldset disables every control inside (nothing submitted), while the header
	     toggle above stays usable on read-only forms. -->
	<fieldset class="kc-row-card__body" hidden={collapsed} disabled={readOnly}>
		{@render children()}
	</fieldset>
</div>

<style>
	.kc-row-card {
		min-width: 0;
		max-width: 100%;
	}
	.kc-row-card--dragging {
		opacity: 0.5;
	}
	.kc-row-card--drop {
		border-color: var(--kc-accent);
		box-shadow: 0 0 0 1px var(--kc-accent);
	}
	.kc-row-card--error {
		border-color: var(--kc-danger);
	}
	.kc-row-card__head {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		flex-wrap: wrap;
	}
	.kc-row-card__handle {
		cursor: grab;
		padding-inline: 0.375rem;
		letter-spacing: -0.2em;
	}
	.kc-row-card__toggle {
		flex: 1 1 10rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		background: none;
		border: 0;
		padding: 0.375rem 0.25rem;
		font: inherit;
		color: var(--kc-text);
		text-align: left;
		cursor: pointer;
	}
	.kc-row-card__index {
		color: var(--kc-muted);
		font-variant-numeric: tabular-nums;
	}
	.kc-row-card__title {
		font-weight: 600;
	}
	.kc-row-card__sub {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}
	.kc-row-card__err {
		display: inline-grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: var(--kc-danger);
		color: var(--kc-surface);
		font-size: 0.75rem;
		font-weight: 700;
	}
	.kc-row-card__tools {
		display: flex;
		gap: 0.125rem;
		flex-wrap: wrap;
	}
	.kc-row-card__body {
		display: grid;
		gap: 1rem;
		padding: 0.75rem;
		margin: 0;
		min-width: 0;
		border: 0;
		border-top: 1px solid var(--kc-border);
	}
	.kc-row-card__body[hidden] {
		display: none;
	}
	/* Touch / small screens: 44px targets; the tool buttons get their own wrapped row. */
	@media (max-width: 800px), (pointer: coarse) {
		.kc-row-card__handle {
			min-width: 2.75rem;
			min-height: 2.75rem;
			touch-action: none;
		}
		.kc-row-card__toggle {
			min-height: 2.75rem;
			flex-basis: 6rem;
		}
		.kc-row-card__tools {
			flex: 1 1 100%;
			gap: 0.25rem;
		}
		.kc-row-card__tools :global(.kc-btn) {
			min-width: 2.75rem;
		}
	}
</style>
