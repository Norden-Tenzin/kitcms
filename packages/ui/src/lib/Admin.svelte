<script lang="ts">
	// SPIKE (Phase 0): admin shell rendered by the generated route file. The internal router
	// output comes from @kitcms/core/sveltekit/admin's `load`.
	import { resolve } from '$app/paths';
	import EditForm from './EditForm.svelte';
	import type {
		AdminActionFailure,
		AdminActionResult,
		AdminData,
	} from '@kitcms/core/sveltekit/admin';

	type AdminForm = Partial<AdminActionResult & AdminActionFailure> | null | undefined;

	let { data, form }: { data: AdminData; form?: AdminForm } = $props();

	// The generated route file always lives at this route id; resolve() applies `paths.base`.
	const ADMIN = '/(kitcms)/admin/[...path]';
</script>

<div class="kitcms-admin">
	<nav>
		<a href={resolve(ADMIN, { path: '' })}>Dashboard</a>
		{#each data.collections as c (c.slug)}
			<a href={resolve(ADMIN, { path: `collections/${c.slug}` })}>{c.slug}</a>
		{/each}
	</nav>

	{#if data.route.view === 'dashboard'}
		<h1>Dashboard</h1>
		<p data-testid="marker">kitcms admin v0</p>
	{:else if data.route.view === 'list' && data.meta}
		<h1>{data.meta.slug}</h1>
		<ul>
			{#each data.docs ?? [] as doc (doc.id)}
				<li>
					<a href={resolve(ADMIN, { path: `collections/${data.meta.slug}/${doc.id}` })}
						>{doc[data.meta.useAsTitle] ?? doc.id}</a
					>
				</li>
			{/each}
		</ul>
	{:else if data.route.view === 'edit' && data.meta}
		{#if data.doc}
			{#key data.doc.id}
				<EditForm meta={data.meta} doc={data.doc} />
			{/key}
		{/if}
		{#if form?.saved}<p data-testid="saved">Saved</p>{/if}
		{#if form?.message}<p data-testid="error">{form.message}</p>{/if}
	{/if}
</div>

<style>
	.kitcms-admin {
		font-family: system-ui, sans-serif;
	}
	nav {
		display: flex;
		gap: 1rem;
	}
</style>
