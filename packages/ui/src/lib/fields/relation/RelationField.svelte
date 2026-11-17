<script lang="ts">
	// Shared implementation of relationship and upload fields (see ../RelationshipField.svelte and
	// ../UploadField.svelte). Values are document ids: a string|null, or string[] when hasMany.
	// Hidden inputs are SSR-rendered, so existing values survive a no-JS submit; titles and
	// thumbnails are resolved in the browser through the lookup endpoint (SSR shows the id).
	import { tick, untrack, type Snippet } from 'svelte';
	import type { FieldOf } from '@kitcms/core/client';
	import { FORM } from '@kitcms/core/client';
	import { getFormContext } from '../../form/context';
	import { docHref } from '../../links';
	import FieldShell from '../FieldShell.svelte';
	import { RowDrag } from '../rowDrag.svelte';
	import { idOf, moveItem } from '../rows';
	import { fieldId } from '../types';
	import { isImage, lookupDocs, type PickerDoc } from './api';
	import RelationPicker from './RelationPicker.svelte';

	let {
		field,
		path,
		value = $bindable(),
		kind,
		browse,
	}: {
		field: FieldOf<'relationship' | 'upload', 'client'>;
		path: string;
		value: unknown;
		kind: 'relationship' | 'upload';
		/**
		 * EXTENSION POINT (task "Media library grid + <MediaPicker>"): rendered next to the search
		 * box. Call `select(doc)` to pick a document, e.g. from a media-library modal or after an
		 * upload finishes.
		 */
		browse?: Snippet<[{ select: (doc: PickerDoc) => void; disabled: boolean; selectedIds: string[] }]>;
	} = $props();

	const ctx = getFormContext();
	const id = $derived(fieldId(path));
	const readOnly = $derived(Boolean(field.admin.readOnly) || ctx.readOnly);
	const describedBy = $derived(
		[field.admin.description && `${id}-desc`, ctx.errors[path] && `${id}-err`].filter(Boolean).join(' ') ||
			undefined,
	);

	const many = $derived(field.hasMany);
	const ids = $derived.by((): string[] => {
		if (many) return Array.isArray(value) ? value.map(idOf).filter((v): v is string => v !== null) : [];
		const one = idOf(value);
		return one ? [one] : [];
	});
	const full = $derived(many && field.maxRows !== undefined && ids.length >= field.maxRows);
	const atMin = $derived(many && field.minRows !== undefined && ids.length <= field.minRows);

	// Resolved documents by id. Starts empty (SSR shows ids); filled by lookups and picks.
	let docs = $state<Record<string, PickerDoc>>({});
	// Plain (non-reactive) bookkeeping, deliberately not a SvelteSet.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const requested = new Set<string>();

	$effect(() => {
		const missing = ids.filter((i) => !requested.has(i));
		if (missing.length === 0) return;
		for (const i of missing) requested.add(i);
		const controller = new AbortController();
		lookupDocs(field.relationTo, missing, controller.signal)
			.then((found) => {
				untrack(() => {
					for (const d of found) docs[d.id] = d;
				});
			})
			.catch(() => {
				// Offline or no access: keep showing ids. Allow a retry on the next change.
				for (const i of missing) requested.delete(i);
			});
		return () => controller.abort();
	});

	function setIds(next: string[]) {
		value = many ? next : (next[0] ?? null);
	}
	function select(doc: PickerDoc) {
		if (readOnly) return;
		docs[doc.id] = doc;
		requested.add(doc.id);
		if (many) {
			if (!ids.includes(doc.id) && !full) setIds([...ids, doc.id]);
		} else setIds([doc.id]);
	}
	let searchEl: HTMLElement | undefined = $state();
	async function remove(i: number) {
		if (atMin) return;
		setIds(ids.filter((_, j) => j !== i));
		await tick();
		searchEl?.querySelector<HTMLElement>('input[role="combobox"]')?.focus();
	}
	const move = (from: number, to: number) => setIds(moveItem(ids, from, to));
	const drag = new RowDrag(move);

	const noun = $derived(kind === 'upload' ? 'file' : field.relationTo);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefs come from ../../links, which calls resolve() -->
{#snippet entry(docId: string, i: number)}
	{@const doc = docs[docId]}
	<span class="kc-rel__item-main">
		{#if kind === 'upload'}
			{#if isImage(doc)}
				<img class="kc-rel__thumb" src={doc.url} alt="" />
			{:else}
				<span class="kc-rel__thumb kc-rel__file" aria-hidden="true">&#128196;</span>
			{/if}
			<span class="kc-rel__title">{doc?.filename ?? doc?.title ?? docId}</span>
		{:else}
			<span class="kc-rel__title">{doc?.title ?? docId}</span>
		{/if}
	</span>
	<a class="kc-btn kc-btn--ghost" href={docHref(field.relationTo, docId)} target="_blank" rel="noreferrer"
		aria-label="Open {doc?.title ?? docId} in a new tab">Open</a
	>
	{#if !readOnly}
		{#if many}
			<button type="button" class="kc-btn kc-btn--ghost" aria-label="Move {doc?.title ?? docId} up" disabled={i === 0}
				onclick={() => move(i, i - 1)}>&uarr;</button
			>
			<button type="button" class="kc-btn kc-btn--ghost" aria-label="Move {doc?.title ?? docId} down"
				disabled={i === ids.length - 1} onclick={() => move(i, i + 1)}>&darr;</button
			>
		{/if}
		<button type="button" class="kc-btn kc-btn--ghost kc-btn--danger" aria-label="{many ? 'Remove' : 'Clear'} {doc?.title ?? docId}"
			disabled={atMin} onclick={() => remove(i)}>{many ? 'Remove' : 'Clear'}</button
		>
	{/if}
{/snippet}

<FieldShell {field} {path} as={many ? 'fieldset' : 'div'}>
	{#if many}
		<input type="hidden" name={FORM.marker(path)} value="1" disabled={readOnly} />
		{#each ids as docId (docId)}
			<input type="hidden" name={path} value={docId} disabled={readOnly} />
		{/each}
	{:else}
		<input type="hidden" name={path} value={ids[0] ?? ''} disabled={readOnly} />
	{/if}

	{#if many && (field.minRows !== undefined || field.maxRows !== undefined)}
		<p class="kc-muted kc-rel__hint">
			{ids.length} selected{#if field.minRows !== undefined}, min {field.minRows}{/if}{#if field.maxRows !== undefined},
				max {field.maxRows}{/if}
		</p>
	{/if}

	{#if ids.length > 0}
		<ul class="kc-rel__list" aria-label="Selected {noun}">
			{#each ids as docId, i (docId)}
				<li
					class="kc-card kc-rel__item"
					class:kc-rel__item--dragging={drag.from === i}
					class:kc-rel__item--drop={drag.over === i && drag.from !== i}
					ondragover={(e) => drag.dragover(i, e)}
					ondrop={(e) => drag.drop(i, e)}
				>
					{#if many && !readOnly}
						<button type="button" class="kc-btn kc-btn--ghost kc-rel__handle" draggable="true"
							aria-label="Drag to reorder {docs[docId]?.title ?? docId}"
							ondragstart={(e) => drag.start(i, e, (e.currentTarget as HTMLElement).closest('li'))}
							ondragend={drag.end}>&#8942;&#8942;</button
						>
					{/if}
					{@render entry(docId, i)}
				</li>
			{/each}
		</ul>
	{/if}

	{#if !readOnly && !full}
		<div class="kc-rel__search" bind:this={searchEl}>
			<RelationPicker
				{id}
				collection={field.relationTo}
				{kind}
				exclude={many ? ids : []}
				placeholder={many || ids.length === 0 ? `Search ${noun}...` : `Search to replace...`}
				{describedBy}
				invalid={Boolean(ctx.errors[path])}
				onselect={select}
			/>
			{#if browse}{@render browse({ select, disabled: readOnly || full, selectedIds: ids })}{/if}
		</div>
	{:else if ids.length === 0}
		<p class="kc-muted">Nothing selected.</p>
	{/if}
</FieldShell>

<style>
	.kc-rel__hint {
		margin: 0;
		font-size: 0.8125rem;
	}
	.kc-rel__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.375rem;
	}
	.kc-rel__item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.5rem;
	}
	.kc-rel__item--dragging {
		opacity: 0.5;
	}
	.kc-rel__item--drop {
		border-color: var(--kc-accent);
	}
	.kc-rel__item-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.kc-rel__title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.kc-rel__thumb {
		width: 2.5rem;
		height: 2.5rem;
		flex: none;
		object-fit: cover;
		border-radius: calc(var(--kc-radius) - 2px);
		background: var(--kc-bg);
	}
	.kc-rel__file {
		display: grid;
		place-items: center;
		font-size: 1.25rem;
	}
	.kc-rel__handle {
		cursor: grab;
		padding-inline: 0.375rem;
		letter-spacing: -0.2em;
	}
	.kc-rel__search {
		display: flex;
		gap: 0.5rem;
		align-items: start;
	}
	.kc-rel__search > :global(:first-child) {
		flex: 1;
	}
</style>
