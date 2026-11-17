<script lang="ts">
	// Create and edit view. Form state is ONE $state object seeded from props once, at creation
	// (so it also runs during SSR, unlike $effect). The parent re-creates this component per
	// document with {#key}. Field components bind into `values`.
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
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
	import { collectionHref, docHref } from '../links';
	import { formatCell } from '../format';

	let {
		data,
		form,
	}: {
		data: AdminDataOf<'create'> | AdminDataOf<'edit'>;
		form?: AdminActionData | null;
	} = $props();

	const mode = untrack(() => (data.route.view === 'edit' ? 'edit' : 'create'));
	const collection = untrack(() => data.collection);
	const doc = $derived(data.route.view === 'edit' ? data.doc : null);
	const hidden = untrack(
		() => new Set(data.route.view === 'edit' ? (data as AdminDataOf<'edit'>).hiddenFields : []),
	);

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

	const readOnly = untrack(() => mode === 'edit' && !data.permissions.update);
	setFormContext({ collection, mode, readOnly, errors, hidden });

	const title = $derived.by(() => {
		const t = values[collection.admin.useAsTitle];
		if (typeof t === 'string' && t) return t;
		return mode === 'edit' && doc ? doc.id : `New ${collection.labels.singular.toLowerCase()}`;
	});

	let formEl: HTMLFormElement | undefined = $state();
	let submitting = $state(false);

	function validate(): boolean {
		const list = validateDocument(collection.fields, values, {
			// Hidden and read-only top-level fields aren't submitted, so they aren't validated.
			skip: (path, field) =>
				!path.includes('.') &&
				(hidden.has(field.name) || readOnly || Boolean(field.admin.readOnly || field.admin.hidden)),
		});
		if (mode === 'create' && collection.auth && !password) {
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

	function confirmDelete(e: SubmitEvent) {
		if (!confirm(`Delete this ${collection.labels.singular.toLowerCase()}? This can't be undone.`)) {
			e.preventDefault();
		}
	}

	const fmtDate = (v: unknown) => formatCell(collection, 'createdAt', v);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href comes from ../links, which calls resolve() -->

<svelte:head><title>{title} · {collection.labels.plural}</title></svelte:head>

<nav class="crumbs" aria-label="Breadcrumb">
	<a href={collectionHref(collection.slug)}>{collection.labels.plural}</a>
	<span aria-hidden="true">/</span>
	<span>{mode === 'create' ? 'New' : title}</span>
</nav>
<h1>{title}</h1>

<div class="messages" aria-live="polite">
	{#if form?.message}<p class="kc-alert" role="alert" data-testid="error">{form.message}</p>{/if}
	{#if form?.saved}<p class="kc-alert kc-alert--success" role="status" data-testid="saved">Saved</p>{/if}
	{#if form?.references?.length}
		<div class="kc-alert" data-testid="references">
			Still referenced by:
			<ul>
				{#each form.references as r (r.collection + r.id + r.path)}
					<li><a href={docHref(r.collection, r.id)}>{r.collection}/{r.id}</a> <small>({r.path})</small></li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<form
	id="kc-save"
	class="layout"
	method="POST"
	action="?/save"
	novalidate
	bind:this={formEl}
	use:enhance={({ cancel }) => {
		if (!validate()) {
			cancel();
			focusFirstError();
			return;
		}
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
		{#if mode === 'create' && collection.auth}
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
			{#if doc}
				<dl class="meta">
					<dt>ID</dt>
					<dd><code>{doc.id}</code></dd>
					{#if doc.createdAt}<dt>Created</dt><dd>{fmtDate(doc.createdAt)}</dd>{/if}
					{#if doc.updatedAt}<dt>Updated</dt><dd>{fmtDate(doc.updatedAt)}</dd>{/if}
				</dl>
			{/if}
			{#if !readOnly}
				<button class="kc-btn kc-btn--primary" disabled={submitting}>
					{submitting ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
				</button>
			{:else}
				<p class="kc-muted">You can view this document but not change it.</p>
			{/if}
			{#if mode === 'edit' && data.permissions.delete}
				<button class="kc-btn kc-btn--danger" type="submit" form="kc-delete">Delete</button>
			{/if}
		</div>
	</aside>
</form>

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
	@media (max-width: 800px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			position: static;
		}
	}
</style>
