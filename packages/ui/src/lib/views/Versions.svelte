<script lang="ts">
	// The versions list of a document or global (§13.4): when, what, and a restore button per row.
	// Plain forms, so restoring works without JS. Restoring a version of a document with drafts
	// offers "as draft" (published content untouched) and "and publish".
	import { enhance } from '$app/forms';
	import { FORM, type AdminActionData, type AdminDataOf } from '@kitcms/core/client';
	import { adminHref, collectionHref, docHref, globalHref } from '../links';
	import { formatCell, hasDrafts } from '../format';

	let { data, form }: { data: AdminDataOf<'versions'>; form?: AdminActionData | null } = $props();

	const collection = $derived(data.collection);
	const route = $derived(data.route);
	const global = $derived(route.global);
	const drafts = $derived(hasDrafts(collection));
	const canRestore = $derived(data.permissions.update);
	const base = $derived(
		global !== undefined ? `globals/${global}/versions` : `collections/${route.collection}/${route.id}/versions`,
	);
	const back = $derived(global !== undefined ? globalHref(global) : docHref(route.collection!, route.id!));
	const when = (iso: string) => formatCell(collection, 'updatedAt', iso);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href comes from ../links, which calls resolve() -->

<svelte:head><title>Versions · {data.docTitle}</title></svelte:head>

<nav class="crumbs" aria-label="Breadcrumb">
	{#if global !== undefined}
		<a href={adminHref('')}>Dashboard</a>
	{:else}
		<a href={collectionHref(collection.slug)}>{collection.labels.plural}</a>
	{/if}
	<span aria-hidden="true">/</span>
	<a href={back}>{data.docTitle}</a>
	<span aria-hidden="true">/</span>
	<span>Versions</span>
</nav>
<h1>Versions of {data.docTitle}</h1>

<div class="messages" aria-live="polite">
	{#if form?.message}<p class="kc-alert" role="alert" data-testid="error">{form.message}</p>{/if}
</div>

{#if data.versions.length === 0}
	<p class="kc-muted">No versions yet.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th scope="col">Saved</th>
				{#if drafts}<th scope="col">Status</th>{/if}
				<th scope="col">Title</th>
				<th scope="col"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.versions as v (v.id)}
				<tr data-version-id={v.id}>
					<td>
						{when(v.createdAt)}
						{#if v.latest}<span class="kc-badge">Latest</span>{/if}
						{#if v.autosave}<span class="kc-badge" title="Saved automatically">Autosave</span>{/if}
					</td>
					{#if drafts}
						<td>
							<span class="kc-badge" class:kc-badge--published={v.status === 'published'}
								>{v.status === 'published' ? 'Published' : 'Draft'}</span
							>
						</td>
					{/if}
					<td>{v.label ?? '—'}</td>
					<td class="actions">
						{#if canRestore}
							<form method="POST" action="?/restoreVersion" use:enhance>
								<input type="hidden" name={FORM.versionId} value={v.id} />
								{#if drafts}
									<button class="kc-btn" name={FORM.draft} value="1">Restore as draft</button>
									<button class="kc-btn">Restore and publish</button>
								{:else}
									<button class="kc-btn">Restore</button>
								{/if}
							</form>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<nav class="pager" aria-label="Pagination">
	<span class="kc-muted">Page {data.page} of {data.totalPages} · {data.totalDocs} versions</span>
	{#if data.page > 1}<a href={adminHref(base, { page: data.page - 1 })}>Previous</a>{/if}
	{#if data.page < data.totalPages}<a href={adminHref(base, { page: data.page + 1 })}>Next</a>{/if}
	<a href={back}>Back</a>
</nav>

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
		margin-top: 0.75rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
		background: var(--kc-surface);
		border: 1px solid var(--kc-border);
	}
	th,
	td {
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--kc-border);
	}
	.actions form {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.pager {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-top: 1rem;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
