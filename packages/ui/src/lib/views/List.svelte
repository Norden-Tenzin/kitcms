<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { FORM, type AdminDataOf } from '@kitcms/core/client';
	import { collectionHref, createHref, docHref } from '../links';
	import { columnLabel, formatCell, isSortable } from '../format';
	import FileUpload from '../upload/FileUpload.svelte';
	import { RowDrag } from '../fields/rowDrag.svelte';
	import { fileLabel, isImageMime, metaLine, thumbUrl } from '../media/util';

	let { data }: { data: AdminDataOf<'list'> } = $props();

	const collection = $derived(data.collection);
	const query = $derived(data.query);
	const columns = $derived(collection.admin.defaultColumns);
	const titleColumn = $derived(
		columns.includes(collection.admin.useAsTitle) ? collection.admin.useAsTitle : columns[0],
	);
	const searchable = $derived(collection.admin.listSearchableFields.length > 0);
	const from = $derived(data.totalDocs === 0 ? 0 : (query.page - 1) * query.limit + 1);
	const to = $derived(Math.min(query.page * query.limit, data.totalDocs));
	const sortField = $derived(query.sort.replace(/^-/, ''));
	const sortDesc = $derived(query.sort.startsWith('-'));

	const isMedia = $derived(Boolean(collection.upload));
	const grid = $derived(isMedia && query.view !== 'table');

	let selected = $state<string[]>([]);
	const allSelected = $derived(data.docs.length > 0 && selected.length === data.docs.length);

	const href = (over: Record<string, string | number | undefined>) =>
		collectionHref(collection.slug, {
			page: query.page,
			limit: query.limit,
			sort: query.sort,
			q: query.q,
			view: isMedia ? (query.view ?? 'grid') : undefined,
			...over,
		});
	// Clicking a sorted column toggles direction; a new column starts ascending.
	const sortHref = (name: string) =>
		href({ page: 1, sort: sortField === name && !sortDesc ? `-${name}` : name });
	const ariaSort = (name: string) =>
		sortField !== name ? undefined : sortDesc ? 'descending' : 'ascending';

	// ----- reordering (orderable collections, §13.2) ---------------------------------------------
	// Only while the list is in manual order: sorted by `_order` ascending, unfiltered, and the user
	// may update documents. Rows reorder optimistically; a failed move reverts and shows a message.
	const canReorder = $derived(
		Boolean(collection.orderable) &&
			sortField === '_order' &&
			!sortDesc &&
			!query.q &&
			data.permissions.update &&
			!grid,
	);
	let optimistic = $state<typeof data.docs | null>(null);
	let moveError = $state('');
	let moving = $state(false);
	const rows = $derived(optimistic ?? data.docs);
	// A fresh load (after a move, or navigation) replaces the optimistic order.
	$effect.pre(() => {
		void data.docs;
		optimistic = null;
	});

	async function moveRow(from: number, to: number) {
		if (moving || from === to || to < 0 || to >= rows.length) return;
		const id = rows[from]!.id;
		const targetId = rows[to]!.id;
		const next = [...rows];
		next.splice(to, 0, next.splice(from, 1)[0]!);
		optimistic = next;
		moveError = '';
		moving = true;
		const body = new FormData();
		body.set('id', id);
		body.set(to > from ? 'after' : 'before', targetId);
		try {
			const res = await fetch('?/move', {
				method: 'POST',
				body,
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
			});
			const result = deserialize(await res.text());
			if (result.type === 'success') await invalidateAll();
			else {
				optimistic = null;
				moveError =
					(result.type === 'failure' && (result.data as { message?: string } | undefined)?.message) ||
					'Could not move the document.';
			}
		} catch {
			optimistic = null;
			moveError = 'Could not move the document.';
		} finally {
			moving = false;
		}
	}

	const drag = new RowDrag((from, to) => void moveRow(from, to));
	// `page`/`limit` stay in the action URL so the no-JS fallback returns to the same page.
	const moveAction = $derived(`?/move&page=${query.page}&limit=${query.limit}`);

	function handleKey(e: KeyboardEvent, i: number) {
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		e.preventDefault();
		void moveRow(i, e.key === 'ArrowUp' ? i - 1 : i + 1);
	}

	function toggleAll() {
		selected = allSelected ? [] : data.docs.map((d) => d.id);
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href comes from ../links, which calls resolve() -->

<div class="head">
	<h1>
		{collection.labels.plural}
		{#if collection.admin.locked}<span class="badge" title="Documents can be edited but not created or deleted">Locked</span>{/if}
	</h1>
	{#if data.permissions.create}
		<a class="kc-btn kc-btn--primary" href={createHref(collection.slug)}>
			Create new {collection.labels.singular.toLowerCase()}
		</a>
	{/if}
</div>

<div class="toolbar">
	{#if searchable}
		<form method="GET" action={collectionHref(collection.slug)} role="search" class="search">
			<input type="hidden" name="limit" value={query.limit} />
			{#if isMedia}<input type="hidden" name="view" value={query.view ?? 'grid'} />{/if}
			{#if query.sort}<input type="hidden" name="sort" value={query.sort} />{/if}
			<input
				class="kc-input"
				type="search"
				name="q"
				value={query.q}
				placeholder="Search {collection.labels.plural.toLowerCase()}"
				aria-label="Search"
			/>
			<button class="kc-btn">Search</button>
			{#if query.q}<a class="kc-btn kc-btn--ghost" href={href({ q: '', page: 1 })}>Clear</a>{/if}
		</form>
	{/if}
	{#if isMedia}
		<div class="view-toggle" role="group" aria-label="Layout">
			<a class="kc-btn" href={href({ view: 'grid' })} aria-current={grid ? 'true' : undefined}>Grid</a>
			<a class="kc-btn" href={href({ view: 'table' })} aria-current={!grid ? 'true' : undefined}>Table</a>
		</div>
	{/if}
	{#if data.permissions.delete}
		<form
			id="kc-bulk"
			method="POST"
			action="?/bulkDelete"
			use:enhance={({ cancel }) => {
				if (selected.length === 0 || !confirm(`Delete ${selected.length} selected document(s)? This can't be undone.`)) {
					cancel();
					return;
				}
				return async ({ update }) => {
					await update({ reset: false });
					selected = [];
				};
			}}
		>
			<!-- The row checkboxes (name FORM.ids, form="kc-bulk") submit with this form, with or without JS. -->
			<button class="kc-btn kc-btn--danger">
				Delete selected{selected.length ? ` (${selected.length})` : ''}
			</button>
		</form>
	{/if}
</div>

{#if isMedia && data.permissions.create}
	<div class="media-upload">
		<FileUpload {collection} showCurrent={false} onuploaded={() => invalidateAll()} />
	</div>
{/if}

{#if grid && data.docs.length > 0}
	<ul class="media-grid" aria-label={collection.labels.plural}>
		{#each data.docs as doc (doc.id)}
			<li class="kc-card tile" class:tile--selected={selected.includes(doc.id)}>
				{#if data.permissions.delete}
					<input
						class="tile__check"
						type="checkbox"
						name={FORM.ids}
						value={doc.id}
						form="kc-bulk"
						aria-label="Select {String(doc.filename ?? doc.id)}"
						checked={selected.includes(doc.id)}
						onchange={(e) => {
							selected = e.currentTarget.checked
								? [...selected, doc.id]
								: selected.filter((s) => s !== doc.id);
						}}
					/>
				{/if}
				<a class="tile__link" href={docHref(collection.slug, doc.id)}>
					<span class="tile__thumb">
						{#if isImageMime(doc.mimeType) && typeof doc.url === 'string'}
							<img src={thumbUrl(doc.url, 320)} alt={typeof doc.alt === 'string' ? doc.alt : ''} loading="lazy" />
						{:else}
							<span class="tile__file" aria-hidden="true">{fileLabel(doc.mimeType, doc.filename)}</span>
						{/if}
					</span>
					<span class="tile__name">{String(doc.filename ?? doc.id)}</span>
					<span class="tile__meta kc-muted">{metaLine(doc)}</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
{#if moveError}<p class="kc-alert" role="alert">{moveError}</p>{/if}
<div class="kc-card table-wrap">
	{#if data.docs.length === 0}
		<p class="kc-muted empty">
			{query.q ? 'No documents match your search.' : `No ${collection.labels.plural.toLowerCase()} yet.`}
		</p>
	{:else}
		<table>
			<thead>
				<tr>
					{#if canReorder}<th class="handle-col"><span class="sr-only">Reorder</span></th>{/if}
					{#if data.permissions.delete}
						<th class="check">
							<input
								type="checkbox"
								aria-label="Select all"
								checked={allSelected}
								onchange={toggleAll}
							/>
						</th>
					{/if}
					{#each columns as name (name)}
						<th scope="col" aria-sort={ariaSort(name)}>
							{#if isSortable(collection, name)}
								<a href={sortHref(name)}>
									{columnLabel(collection, name)}
									{#if sortField === name}<span aria-hidden="true">{sortDesc ? '↓' : '↑'}</span>{/if}
								</a>
							{:else}
								{columnLabel(collection, name)}
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as doc, i (doc.id)}
					<tr
						data-row-id={doc.id}
						class:dragging={drag.from === i}
						class:drop-target={drag.over === i && drag.from !== i}
						ondragover={canReorder ? (e) => drag.dragover(i, e) : undefined}
						ondrop={canReorder ? (e) => drag.drop(i, e) : undefined}
					>
						{#if canReorder}
							<td class="handle-col">
								<button
									type="button"
									class="handle"
									draggable="true"
									aria-label="Reorder {String(doc[collection.admin.useAsTitle] ?? doc.id)}: use arrow up and down"
									ondragstart={(e) => drag.start(i, e, e.currentTarget.closest('tr'))}
									ondragend={drag.end}
									onkeydown={(e) => handleKey(e, i)}>⠿</button
								>
								<noscript>
									<form method="POST" action={moveAction} class="move-form">
										<input type="hidden" name="id" value={doc.id} />
										{#if i > 0}
											<button class="kc-btn" name="before" value={rows[i - 1]!.id}>Move up</button>
										{/if}
										{#if i < rows.length - 1}
											<button class="kc-btn" name="after" value={rows[i + 1]!.id}>Move down</button>
										{/if}
									</form>
								</noscript>
							</td>
						{/if}
						{#if data.permissions.delete}
							<td class="check">
								<input
									type="checkbox"
									name={FORM.ids}
									value={doc.id}
									form="kc-bulk"
									aria-label="Select {String(doc[collection.admin.useAsTitle] ?? doc.id)}"
									checked={selected.includes(doc.id)}
									onchange={(e) => {
										selected = e.currentTarget.checked
											? [...selected, doc.id]
											: selected.filter((s) => s !== doc.id);
									}}
								/>
							</td>
						{/if}
						{#each columns as name (name)}
							<td>
								{#if name === titleColumn}
									<a href={docHref(collection.slug, doc.id)}>{formatCell(collection, name, doc[name])}</a>
								{:else if name === '_status'}
									<span class="kc-badge" class:kc-badge--published={doc._status === 'published'} data-testid="status"
										>{formatCell(collection, name, doc[name])}</span
									>
								{:else}
									{formatCell(collection, name, doc[name])}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
{/if}

<nav class="pager" aria-label="Pagination">
	<span class="kc-muted">{from}–{to} of {data.totalDocs}</span>
	<form method="GET" action={collectionHref(collection.slug)} class="limit">
		<input type="hidden" name="q" value={query.q} />
		<input type="hidden" name="sort" value={query.sort} />
		{#if isMedia}<input type="hidden" name="view" value={query.view ?? 'grid'} />{/if}
		<label>
			Per page
			<select class="kc-input" name="limit" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				{#each [10, 25, 50, 100] as n (n)}
					<option value={n} selected={n === query.limit}>{n}</option>
				{/each}
			</select>
		</label>
		<noscript><button class="kc-btn">Apply</button></noscript>
	</form>
	{#if query.page > 1}
		<a class="kc-btn" rel="prev" href={href({ page: query.page - 1 })}>Previous</a>
	{:else}
		<span class="kc-btn" aria-disabled="true">Previous</span>
	{/if}
	{#if query.page < data.totalPages}
		<a class="kc-btn" rel="next" href={href({ page: query.page + 1 })}>Next</a>
	{:else}
		<span class="kc-btn" aria-disabled="true">Next</span>
	{/if}
</nav>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin: 1rem 0;
	}
	.search {
		display: flex;
		gap: 0.5rem;
		flex: 1;
		max-width: 28rem;
	}
	.view-toggle {
		display: flex;
		gap: 0.25rem;
	}
	.view-toggle [aria-current='true'] {
		background: var(--kc-accent);
		color: var(--kc-accent-text);
		border-color: var(--kc-accent);
	}
	.media-upload {
		margin-bottom: 1rem;
	}
	.media-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 0.75rem;
	}
	.tile {
		position: relative;
		padding: 0.5rem;
	}
	.tile--selected {
		border-color: var(--kc-accent);
	}
	.tile__check {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 1;
		width: 1.1rem;
		height: 1.1rem;
	}
	.tile__link {
		display: grid;
		gap: 0.2rem;
		color: inherit;
		text-decoration: none;
	}
	.tile__thumb {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: calc(var(--kc-radius) - 2px);
		background: var(--kc-bg);
	}
	.tile__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.tile__file {
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--kc-muted);
		border: 2px solid var(--kc-border);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
	}
	.tile__name {
		font-weight: 600;
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tile__meta {
		font-size: 0.75rem;
		min-height: 1em;
	}
	.badge {
		display: inline-block;
		vertical-align: middle;
		margin-left: 0.5rem;
		padding: 0.1rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 600;
		border: 1px solid var(--kc-border);
		border-radius: 999px;
		color: var(--kc-muted);
	}
	.handle-col {
		width: 2.5rem;
	}
	.handle {
		cursor: grab;
		border: 0;
		background: none;
		color: var(--kc-muted);
		font-size: 1.1rem;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
	}
	.handle:hover,
	.handle:focus-visible {
		color: var(--kc-text);
	}
	.move-form {
		display: flex;
		gap: 0.25rem;
	}
	tr.dragging {
		opacity: 0.5;
	}
	tr.drop-target td {
		border-top: 2px solid var(--kc-accent);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.table-wrap {
		padding: 0;
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		padding: 0.55rem 0.8rem;
		border-bottom: 1px solid var(--kc-border);
		white-space: nowrap;
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	th {
		font-weight: 600;
		color: var(--kc-muted);
		font-size: 0.8125rem;
	}
	th a {
		color: inherit;
		text-decoration: none;
	}
	th a:hover {
		color: var(--kc-text);
	}
	.check {
		width: 2rem;
	}
	.empty {
		padding: 1.5rem;
		margin: 0;
		text-align: center;
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 1rem;
	}
	.pager .limit {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.pager label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--kc-muted);
	}
	.pager select {
		width: auto;
	}
	[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
