<script lang="ts">
	// The admin root. Defines the theme scope (`.kitcms-admin`) and switches on the route view.
	import './theme.css';
	import { enhance } from '$app/forms';
	import type { AdminActionData, AdminData, AdminDataOf } from '@kitcms/core/client';
	import { adminHref, collectionHref, globalHref } from './links';
	import Login from './views/Login.svelte';
	import FirstUser from './views/FirstUser.svelte';
	import Dashboard from './views/Dashboard.svelte';
	import List from './views/List.svelte';
	import type { AdminClientConfig } from './preview/types';
	import Edit from './views/Edit.svelte';
	import Versions from './views/Versions.svelte';

	let {
		data,
		form,
		admin,
	}: { data: AdminData; form?: AdminActionData | null; admin?: AdminClientConfig } = $props();

	type Signed = Exclude<AdminData, { route: { view: 'login' | 'create-first-user' } }>;
	// TypeScript doesn't narrow `data` from `data.route.view`, so views get a typed accessor.
	const as = <V extends AdminData['route']['view']>(v: V) =>
		data.route.view === v ? (data as AdminDataOf<V>) : null;
	const dashboard = $derived(as('dashboard'));
	const list = $derived(as('list'));
	const editing = $derived(as('create') ?? as('edit') ?? as('global'));
	const versions = $derived(as('versions'));
	const signed = $derived(
		data.route.view === 'login' || data.route.view === 'create-first-user'
			? null
			: (data as Signed),
	);

	// Multi-tenancy (§15.3): absent on hand-built fixtures and without the plugin.
	const tenancy = $derived(signed?.tenancy ?? null);

	let navOpen = $state(false);

	// Nav grouped by `group`; ungrouped collections first.
	const groups = $derived.by(() => {
		if (!signed) return [];
		const by: Record<string, Signed['nav']> = {};
		for (const item of signed.nav) (by[item.group ?? ''] ??= []).push(item);
		return Object.entries(by).sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
	});
	const activeSlug = $derived('collection' in data.route ? data.route.collection : undefined);
	const activeGlobal = $derived('global' in data.route ? data.route.global : undefined);
	// Edit views are also re-keyed on `updatedAt`, so the form re-seeds from the saved document
	// (server-derived values such as generated slugs show up after a save).
	const viewKey = $derived(
		data.route.view +
			('id' in data.route ? data.route.id : '') +
			('global' in data.route ? data.route.global : '') +
			((data.route.view === 'edit' || data.route.view === 'global') && 'doc' in data
				? String(data.doc.updatedAt ?? '')
				: ''),
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href comes from ../links, which calls resolve() -->

<svelte:head><title>{data.title}</title></svelte:head>

<div
	class="kitcms-admin"
	style:--kc-accent={data.branding.colors.accent}
	style:--kc-accent-text={data.branding.colors.accentText}
>
	{#if data.route.view === 'login'}
		<Login title={data.title} logo={data.branding.logo} message={form?.message} />
	{:else if data.route.view === 'create-first-user'}
		<FirstUser title={data.title} logo={data.branding.logo} message={form?.message} />
	{:else if signed}
		<div class="shell">
			<header class="top">
				<button
					class="kc-btn kc-btn--ghost menu"
					aria-expanded={navOpen}
					aria-controls="kc-nav"
					onclick={() => (navOpen = !navOpen)}>Menu</button
				>
				<a class="brand" href={adminHref('')}>
					{#if data.branding.logo}<img class="logo" src={data.branding.logo} alt={data.title} />{/if}
					{data.title}
				</a>
				<span class="spacer"></span>
				{#if tenancy}
					{#if tenancy.tenants.length > 1 || tenancy.canSelectAll}
						<form method="POST" action="?/setTenant" use:enhance class="tenant" data-testid="tenant-switcher">
							<label>
								<span class="kc-muted">Tenant</span>
								<select
									class="kc-input"
									name="tenant"
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								>
									{#if tenancy.canSelectAll}
										<option value="" selected={tenancy.current === null}>All tenants</option>
									{/if}
									{#each tenancy.tenants as t (t.id)}
										<option value={t.id} selected={t.id === tenancy.current}>{t.title}</option>
									{/each}
								</select>
							</label>
							<noscript><button class="kc-btn">Switch</button></noscript>
						</form>
					{:else if tenancy.tenants[0]}
						<span class="tenant-name" data-testid="tenant-name">{tenancy.tenants[0].title}</span>
					{/if}
				{/if}
				<span class="who" data-testid="whoami">{signed.user.email}</span>
				<form method="POST" action="?/logout" use:enhance>
					<button class="kc-btn kc-btn--ghost">Log out</button>
				</form>
			</header>
			<nav id="kc-nav" class="nav" data-open={navOpen} aria-label="Main">
				<a
					href={adminHref('')}
					aria-current={data.route.view === 'dashboard' ? 'page' : undefined}
					onclick={() => (navOpen = false)}>Dashboard</a
				>
				{#each groups as [group, items] (group)}
					{#if group}<span class="group">{group}</span>{/if}
					{#each items as item (item.slug)}
						<a
							href={collectionHref(item.slug)}
							aria-current={item.slug === activeSlug ? 'page' : undefined}
							onclick={() => (navOpen = false)}>{item.label}</a
						>
					{/each}
				{/each}
				{#if signed.globals.length > 0}
					<span class="group">Globals</span>
					{#each signed.globals as item (item.slug)}
						<a
							href={globalHref(item.slug)}
							aria-current={item.slug === activeGlobal ? 'page' : undefined}
							onclick={() => (navOpen = false)}>{item.label}</a
						>
					{/each}
				{/if}
			</nav>
			<main class="content">
				{#if dashboard}
					<Dashboard data={dashboard} />
				{:else if list}
					{#key viewKey}<List data={list} />{/key}
				{:else if editing}
					{#key viewKey}<Edit data={editing} {form} {admin} />{/key}
				{:else if versions}
					<Versions data={versions} {form} />
				{/if}
			</main>
		</div>
	{/if}
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 14rem minmax(0, 1fr);
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'top top'
			'nav content';
		min-height: 100vh;
	}
	.top {
		grid-area: top;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		background: var(--kc-surface);
		border-bottom: 1px solid var(--kc-border);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 700;
		color: var(--kc-text);
		text-decoration: none;
	}
	.logo {
		height: 24px;
		width: auto;
	}
	.spacer {
		flex: 1;
	}
	.who {
		color: var(--kc-muted);
	}
	.menu {
		display: none;
	}
	.tenant {
		display: flex;
		align-items: center;
	}
	.tenant label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.875rem;
	}
	.tenant select {
		width: auto;
	}
	.tenant-name {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.nav {
		grid-area: nav;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 1rem 0.75rem;
		background: var(--kc-surface);
		border-right: 1px solid var(--kc-border);
	}
	.nav a {
		padding: 0.4rem 0.6rem;
		border-radius: var(--kc-radius);
		color: var(--kc-text);
		text-decoration: none;
	}
	.nav a:hover {
		background: color-mix(in srgb, var(--kc-muted) 15%, transparent);
	}
	.nav a[aria-current='page'] {
		background: var(--kc-accent);
		color: var(--kc-accent-text);
	}
	.group {
		margin-top: 0.75rem;
		padding: 0 0.6rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--kc-muted);
	}
	.content {
		grid-area: content;
		padding: 1.25rem;
		min-width: 0;
	}
	@media (max-width: 800px) {
		.shell {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'top'
				'nav'
				'content';
			grid-template-rows: auto auto 1fr;
		}
		.menu {
			display: inline-flex;
		}
		.who {
			display: none;
		}
		.nav {
			border-right: 0;
			border-bottom: 1px solid var(--kc-border);
		}
		.nav[data-open='false'] {
			display: none;
		}
	}
</style>
