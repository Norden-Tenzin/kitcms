<script lang="ts">
	// Create and edit view. Form state is ONE $state object seeded from props once, at creation
	// (so it also runs during SSR, unlike $effect). The parent re-creates this component per
	// document with {#key}. Field components bind into `values`.
	import { untrack } from 'svelte';
	import { deserialize, enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import FileUpload from '../upload/FileUpload.svelte';
	import {
		FORM,
		validateDocument,
		type AdminActionData,
		type AdminDataOf,
		type FieldError,
	} from '@kitcms/core/client';
	import { setFormContext } from '../form/context';
	import RenderFields from '../fields/RenderFields.svelte';
	import { adminHref, collectionHref, docHref, globalVersionsHref, refHref, versionsHref } from '../links';
	import { autosaveInterval, formatCell, hasDrafts } from '../format';
	import type { AdminClientConfig, DocPreviewProps, LazyComponent } from '../preview/types';
	import { collectBlocks } from '../preview/blocks';
	import PreviewPane from '../preview/PreviewPane.svelte';
	import LazyPreview from '../preview/LazyPreview.svelte';
	import BlocksPreview from '../preview/BlocksPreview.svelte';

	let {
		data,
		form,
		admin,
	}: {
		data: AdminDataOf<'create'> | AdminDataOf<'edit'> | AdminDataOf<'global'>;
		form?: AdminActionData | null;
		admin?: AdminClientConfig;
	} = $props();

	// `global`: the single document of a global (§13.1), edited like a document but never created
	// or deleted. Its `collection` is the global's client collection.
	const mode = untrack(() =>
		data.route.view === 'global' ? 'global' : data.route.view === 'edit' ? 'edit' : 'create',
	);
	const collection = untrack(() => data.collection);
	const doc = $derived(data.route.view === 'create' ? null : data.doc);
	const hidden = untrack(
		() => new Set(data.route.view === 'create' ? [] : (data as AdminDataOf<'edit'>).hiddenFields),
	);
	// Reference labels: `_global_<slug>` refs show the global's label.
	const globalLabels = untrack(() => new Map(data.globals.map((g) => [g.slug, g.label])));
	const refLabel = (c: string) =>
		c.startsWith('_global_') ? (globalLabels.get(c.slice('_global_'.length)) ?? c) : c;

	let values = $state<Record<string, unknown>>(
		structuredClone(untrack(() => (form?.values ? { ...data.doc, ...form.values } : data.doc))),
	);

	const errors = $state<Record<string, string>>({});
	function setErrors(list: FieldError[] | undefined) {
		for (const k of Object.keys(errors)) delete errors[k];
		for (const e of list ?? []) errors[e.path] ??= e.message;
	}
	// Seeded for the no-JS reload; the effect applies errors from later enhanced submissions.
	untrack(() => setErrors(form?.errors));
	$effect(() => {
		setErrors(form?.errors);
	});

	const readOnly = untrack(() => mode !== 'create' && !data.permissions.update);

	// ----- drafts (§13.4) -------------------------------------------------------------------------
	const drafts = untrack(() => hasDrafts(collection));
	const status = $derived(data.route.view === 'create' ? undefined : (data as AdminDataOf<'edit'>).status);
	const versionCount = $derived(
		data.route.view === 'create' ? undefined : (data as AdminDataOf<'edit'>).versionCount,
	);
	const statusLabel = $derived(
		status === 'published' ? 'Published' : status === 'changed' ? 'Published, with draft changes' : 'Draft',
	);
	// Autosave: only on documents that exist (create has no id yet), never read-only.
	const interval = untrack(() => autosaveInterval(collection));
	const canAutosave = untrack(() => drafts && interval > 0 && mode !== 'create' && !readOnly);
	let autosaveMsg = $state('');
	setFormContext({ collection, mode, readOnly, errors, hidden });

	const title = $derived.by(() => {
		const t = values[collection.admin.useAsTitle];
		if (typeof t === 'string' && t) return t;
		if (mode === 'global') return collection.labels.singular;
		return mode === 'edit' && doc ? doc.id : `New ${collection.labels.singular.toLowerCase()}`;
	});

	let formEl: HTMLFormElement | undefined = $state();
	let submitting = $state(false);

	function validate(draft = false): boolean {
		const list = validateDocument(collection.fields, values, {
			// A draft save doesn't enforce `required` / `minRows` (the server doesn't either).
			draft,
			// Hidden and read-only top-level fields aren't submitted, so they aren't validated.
			skip: (path, field) =>
				!path.includes('.') &&
				(hidden.has(field.name) || readOnly || Boolean(field.admin.readOnly || field.admin.hidden)),
		});
		if (mode === 'create' && collection.auth && !password && !invite) {
			list.push({ path: FORM.password, message: 'Password is required.' });
		}
		setErrors(list);
		return list.length === 0;
	}

	function focusFirstError() {
		const first = Object.keys(errors)[0];
		if (!first || !formEl) return;
		const el = formEl.querySelector<HTMLElement>(`[data-path="${CSS.escape(first)}"]`);
		el?.scrollIntoView({ block: 'center' });
		el?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
	}

	let password = $state('');
	// Auth create: email a set-password invite instead (Decision 37), when the server says email works.
	const canInvite = $derived(data.route.view === 'create' && (data as AdminDataOf<'create'>).canInvite === true);
	let invite = $state(false);

	// ----- autosave ---------------------------------------------------------------------------------
	let lastSnap = untrack(() => JSON.stringify($state.snapshot(values)));
	let timer: ReturnType<typeof setTimeout> | undefined;
	let autosaving = false;

	$effect(() => {
		if (!canAutosave) return;
		// Reads every value (deeply), so any edit re-runs this and restarts the debounce.
		const snap = JSON.stringify($state.snapshot(values));
		if (snap === lastSnap) return;
		clearTimeout(timer);
		timer = setTimeout(() => void autosave(), interval);
	});
	$effect(() => () => clearTimeout(timer));

	async function autosave() {
		if (!formEl) return;
		// Never autosave over a manual submit; try again after the next interval.
		if (submitting || autosaving) {
			timer = setTimeout(() => void autosave(), interval);
			return;
		}
		autosaving = true;
		autosaveMsg = 'Saving…';
		const snap = JSON.stringify($state.snapshot(values));
		try {
			const body = new FormData(formEl);
			body.set(FORM.draft, '1');
			body.set(FORM.autosave, '1');
			const res = await fetch('?/save', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
			const result = deserialize(await res.text());
			if (result.type === 'success') {
				lastSnap = snap;
				autosaveMsg = `Saved ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
			} else {
				autosaveMsg = "Couldn't autosave";
			}
		} catch {
			autosaveMsg = "Couldn't autosave";
		} finally {
			autosaving = false;
		}
	}

	// ----- live preview (§13.5) ---------------------------------------------------------------------
	// A collection/global preview wins; otherwise a default preview renders the blocks in order when
	// at least one block in the current form state has a registered preview.
	const docPreview = untrack(() =>
		(mode === 'global' && collection.globalSlug
			? (admin?.previews?.globals as Record<string, LazyComponent<DocPreviewProps> | undefined> | undefined)?.[
					collection.globalSlug
				]
			: (admin?.previews?.collections as Record<string, LazyComponent<DocPreviewProps> | undefined> | undefined)?.[
					collection.slug
				]),
	);
	const blockLoaders = untrack(() => admin?.previews?.blocks);
	const hasBlockLoaders = Boolean(blockLoaders && Object.keys(blockLoaders).length > 0);
	const blockEntries = $derived(
		!docPreview && hasBlockLoaders ? collectBlocks(collection.fields, values) : [],
	);
	const hasPreview = $derived(
		Boolean(docPreview) || blockEntries.some((e) => blockLoaders?.[e.block.blockType]),
	);
	const hiddenKey = `kitcms:preview-hidden:${collection.slug}`;
	let previewHidden = $state(false);
	$effect(() => {
		try {
			const stored = localStorage.getItem(hiddenKey);
			// No saved choice: on small screens the preview starts collapsed (toggle to show it).
			previewHidden = stored === null ? window.matchMedia('(max-width: 800px)').matches : stored === '1';
		} catch {
			// storage unavailable: keep the default
		}
	});
	function togglePreview() {
		previewHidden = !previewHidden;
		try {
			localStorage.setItem(hiddenKey, previewHidden ? '1' : '0');
		} catch {
			// not persisted
		}
	}
	const showPreview = $derived(hasPreview && !previewHidden);

	function confirmDelete(e: SubmitEvent) {
		if (!confirm(`Delete this ${collection.labels.singular.toLowerCase()}? This can't be undone.`)) {
			e.preventDefault();
		}
	}

	const fmtDate = (v: unknown) => formatCell(collection, 'createdAt', v);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href comes from ../links, which calls resolve() -->

<svelte:head><title>{mode === 'global' ? title : `${title} · ${collection.labels.plural}`}</title></svelte:head>

<nav class="crumbs" aria-label="Breadcrumb">
	{#if mode === 'global'}
		<a href={adminHref('')}>Dashboard</a>
	{:else}
		<a href={collectionHref(collection.slug)}>{collection.labels.plural}</a>
	{/if}
	<span aria-hidden="true">/</span>
	<span>{mode === 'create' ? 'New' : title}</span>
</nav>
<div class="title-row">
	<h1>{title}</h1>
	{#if hasPreview}
		<button
			type="button"
			class="kc-btn kc-btn--ghost"
			aria-pressed={!previewHidden}
			data-testid="preview-toggle"
			onclick={togglePreview}>{previewHidden ? 'Show preview' : 'Hide preview'}</button
		>
	{/if}
</div>

<div class="messages" aria-live="polite">
	{#if form?.message}<p class="kc-alert" role="alert" data-testid="error">{form.message}</p>{/if}
	{#if form?.saved}<p class="kc-alert kc-alert--success" role="status" data-testid="saved">Saved</p>{/if}
	{#if form?.references?.length}
		<div class="kc-alert" data-testid="references">
			Still referenced by:
			<ul>
				{#each form.references as r (r.collection + r.id + r.path)}
					<li><a href={refHref(r.collection, r.id)}>{r.collection.startsWith('_global_') ? refLabel(r.collection) : `${r.collection}/${r.id}`}</a> <small>({r.path})</small></li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<div class="edit" class:with-preview={showPreview}>
<form
	id="kc-save"
	class="layout"
	class:stacked={showPreview}
	method="POST"
	action="?/save"
	novalidate
	bind:this={formEl}
	use:enhance={({ cancel, submitter }) => {
		const asDraft = drafts && submitter?.getAttribute('name') === FORM.draft;
		if (!validate(asDraft)) {
			cancel();
			focusFirstError();
			return;
		}
		clearTimeout(timer);
		submitting = true;
		// reset: false. The default form.reset() would wipe the bound fields after a save.
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	<div class="main kc-card">
		{#if collection.upload}
			<!-- Create: the file must exist first (its metadata fields are required), so uploading
			     creates the document and then opens it. Edit: replaces the file in place. -->
			<FileUpload
				{collection}
				doc={mode === 'edit' ? (doc ?? undefined) : undefined}
				onuploaded={(uploaded) => {
					if (mode === 'create') void goto(docHref(collection.slug, String(uploaded.id)));
					else void invalidateAll();
				}}
			/>
		{/if}
		<RenderFields
			fields={collection.fields}
			layout={collection.layout}
			bind:values
			position="main"
		/>
		{#if mode === 'create' && collection.auth && canInvite}
			<label class="invite">
				<input type="checkbox" name={FORM.invite} bind:checked={invite} />
				Email an invite: they choose their own password
			</label>
		{/if}
		{#if mode === 'create' && collection.auth && !invite}
			<div class="kc-field" data-path={FORM.password}>
				<label for="kc-password">Password<span aria-hidden="true">*</span></label>
				<input
					id="kc-password"
					class="kc-input"
					type="password"
					name={FORM.password}
					autocomplete="new-password"
					bind:value={password}
					aria-invalid={errors[FORM.password] ? 'true' : undefined}
				/>
				{#if errors[FORM.password]}<p class="err" role="alert">{errors[FORM.password]}</p>{/if}
			</div>
		{/if}
	</div>

	<aside class="side">
		<div class="kc-card">
			<RenderFields
				fields={collection.fields}
				layout={collection.layout}
				bind:values
				position="sidebar"
			/>
			{#if drafts && mode !== 'create' && status}
				<p class="status">
					<span
						class="kc-badge"
						class:kc-badge--published={status === 'published'}
						class:kc-badge--changed={status === 'changed'}
						data-testid="doc-status">{statusLabel}</span
					>
				</p>
			{/if}
			{#if doc}
				<dl class="meta">
					<dt>ID</dt>
					<dd><code>{doc.id}</code></dd>
					{#if doc.createdAt}<dt>Created</dt><dd>{fmtDate(doc.createdAt)}</dd>{/if}
					{#if doc.updatedAt}<dt>Updated</dt><dd>{fmtDate(doc.updatedAt)}</dd>{/if}
				</dl>
			{/if}
			{#if !readOnly}
				<!-- Publish comes first: it is what Enter submits, and it works without JS. -->
				<button class="kc-btn kc-btn--primary" disabled={submitting}>
					{submitting ? 'Saving…' : drafts ? 'Publish' : mode === 'create' ? 'Create' : 'Save'}
				</button>
				{#if drafts}
					<button class="kc-btn" name={FORM.draft} value="1" disabled={submitting}>Save draft</button>
				{/if}
				{#if canAutosave}
					<p class="kc-muted autosave" role="status" aria-live="polite" data-testid="autosave">{autosaveMsg}</p>
				{/if}
			{:else}
				<p class="kc-muted">You can view this {mode === 'global' ? 'global' : 'document'} but not change it.</p>
			{/if}
			{#if mode === 'edit' && drafts && data.permissions.update && (status === 'published' || status === 'changed')}
				<button class="kc-btn" type="submit" form="kc-unpublish">Unpublish</button>
			{/if}
			{#if versionCount !== undefined && doc}
				<a class="versions-link" href={mode === 'global' && collection.globalSlug ? globalVersionsHref(collection.globalSlug) : versionsHref(collection.slug, String(doc.id))}
					>Versions ({versionCount})</a
				>
			{/if}
			{#if mode === 'edit' && data.permissions.delete}
				<button class="kc-btn kc-btn--danger" type="submit" form="kc-delete">Delete</button>
			{/if}
		</div>
	</aside>
</form>
{#if showPreview}
	<div class="preview-col">
		<PreviewPane>
			{#if docPreview}
				<LazyPreview loader={docPreview} props={{ doc: values }} label="preview" />
			{:else if blockLoaders}
				<BlocksPreview entries={blockEntries} loaders={blockLoaders} doc={values} />
			{/if}
		</PreviewPane>
	</div>
{/if}
</div>

{#if mode === 'edit' && drafts && data.permissions.update && (status === 'published' || status === 'changed')}
	<form id="kc-unpublish" method="POST" action="?/unpublish" use:enhance></form>
{/if}

{#if mode === 'edit' && data.permissions.delete}
	<form id="kc-delete" method="POST" action="?/delete" onsubmit={confirmDelete} use:enhance></form>
{/if}

{#if mode === 'edit' && collection.auth && data.route.view === 'edit' && (data.permissions.update || (data as AdminDataOf<'edit'>).isSelf)}
	<form class="kc-card pw" method="POST" action="?/setPassword" use:enhance>
		<h2>Change password</h2>
		{#if form?.passwordChanged}
			<p class="kc-alert kc-alert--success" role="status">Password changed.</p>
		{/if}
		{#if (data as AdminDataOf<'edit'>).isSelf}
			<label>
				Current password
				<input
					class="kc-input"
					type="password"
					name={FORM.currentPassword}
					autocomplete="current-password"
					required
				/>
			</label>
		{/if}
		<label>
			New password
			<input
				class="kc-input"
				type="password"
				name={FORM.password}
				autocomplete="new-password"
				minlength="8"
				required
			/>
		</label>
		<button class="kc-btn">Change password</button>
	</form>
{/if}

<style>
	.invite {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-weight: 500;
	}
	.crumbs {
		display: flex;
		gap: 0.4rem;
		color: var(--kc-muted);
		margin-bottom: 0.25rem;
	}
	.crumbs a {
		color: inherit;
	}
	.messages {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.messages ul {
		margin: 0.25rem 0 0;
		padding-left: 1.2rem;
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.edit.with-preview {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}
	.preview-col {
		position: sticky;
		top: 1rem;
		margin-top: 1rem;
	}
	.layout.stacked {
		grid-template-columns: minmax(0, 1fr);
	}
	.layout.stacked .side {
		position: static;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 1rem;
		margin-top: 1rem;
		align-items: start;
	}
	.main {
		display: grid;
		gap: 1rem;
	}
	.side .kc-card {
		display: grid;
		gap: 0.9rem;
	}
	.side {
		position: sticky;
		top: 1rem;
	}
	.status,
	.autosave {
		margin: 0;
	}
	.autosave {
		font-size: 0.8125rem;
		min-height: 1.2em;
	}
	.versions-link {
		font-size: 0.875rem;
	}
	.meta {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.75rem;
		margin: 0;
		font-size: 0.8125rem;
	}
	.meta dt {
		color: var(--kc-muted);
	}
	.meta dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.kc-field {
		display: grid;
		gap: 0.375rem;
		font-weight: 500;
	}
	.err {
		margin: 0;
		color: var(--kc-danger);
		font-size: 0.8125rem;
		font-weight: 400;
	}
	.pw {
		display: grid;
		gap: 0.75rem;
		max-width: 24rem;
		margin-top: 1rem;
	}
	.pw label {
		display: grid;
		gap: 0.3rem;
		font-weight: 500;
	}
	.pw p {
		margin: 0;
	}
	@media (max-width: 1100px) {
		.edit.with-preview {
			grid-template-columns: minmax(0, 1fr);
		}
		.preview-col {
			position: static;
		}
	}
	@media (max-width: 800px) {
		.title-row [data-testid='preview-toggle'] {
			flex: 1 1 100%;
			border-color: var(--kc-border);
		}
		.preview-col {
			margin-top: 0.75rem;
		}
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			position: static;
		}
	}
</style>
