<script lang="ts">
	// The admin root. Defines the theme scope (`.kitcms-admin`) and switches on the route view.
	import './theme.css';
	import { enhance } from '$app/forms';
	import type { AdminActionData, AdminData, AdminDataOf } from '@kitcms/core/client';
	import { adminHref, collectionHref, globalHref, panelHref } from './links';
	import Login from './views/Login.svelte';
	import FirstUser from './views/FirstUser.svelte';
	import ForgotPassword from './views/ForgotPassword.svelte';
	import ResetPassword from './views/ResetPassword.svelte';
	import Dashboard from './views/Dashboard.svelte';
	import List from './views/List.svelte';
	import type { AdminClientConfig } from './preview/types';
	import Edit from './views/Edit.svelte';
	import Versions from './views/Versions.svelte';
	import Panel from './views/Panel.svelte';

	let {
		data,
		form,
		admin,
	}: { data: AdminData; form?: AdminActionData | null; admin?: AdminClientConfig } = $props();

	type PublicView = 'login' | 'create-first-user' | 'forgot-password' | 'reset-password';
	type Signed = Exclude<AdminData, { route: { view: PublicView } }>;
	// TypeScript doesn't narrow `data` from `data.route.view`, so views get a typed accessor.
	const as = <V extends AdminData['route']['view']>(v: V) =>
		data.route.view === v ? (data as AdminDataOf<V>) : null;
	const dashboard = $derived(as('dashboard'));
	const list = $derived(as('list'));
	const editing = $derived(as('create') ?? as('edit') ?? as('global'));
	const versions = $derived(as('versions'));
	const panel = $derived(as('panel'));
	const signed = $derived(
		data.route.view === 'login' ||
			data.route.view === 'create-first-user' ||
			data.route.view === 'forgot-password' ||
			data.route.view === 'reset-password'
			? null
			: (data as Signed),
	);

	let navOpen = $state(false);
	let menuBtn = $state<HTMLButtonElement>();
	let navEl = $state<HTMLElement>();

	// Mobile drawer: focus moves into it when it opens, Escape (or leaving it) closes it and
	// returns focus to the menu button.
	function closeNav(restoreFocus = false) {
		if (!navOpen) return;
		navOpen = false;
		if (restoreFocus) menuBtn?.focus();
	}
	function toggleNav() {
		navOpen = !navOpen;
		if (navOpen) {
			// After the nav is displayed.
			queueMicrotask(() => {
				const first = navEl?.querySelector<HTMLElement>('a[aria-current="page"], a');
				if (navEl && navEl.offsetParent !== null) first?.focus();
			});
		}
	}
	function onNavFocusOut(e: FocusEvent) {
		const to = e.relatedTarget as Node | null;
		if (to && !navEl?.contains(to) && to !== menuBtn) navOpen = false;
	}

	// Nav grouped by `group`; ungrouped collections first.
	const groups = $derived.by(() => {
		if (!signed) return [];
		const by: Record<string, Signed['nav']> = {};
		for (const item of signed.nav) (by[item.group ?? ''] ??= []).push(item);
		return Object.entries(by).sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
	});
	// Plugin panels: grouped by `group` (own section), ungrouped ones under "Plugins".
	const panelGroups = $derived.by(() => {
		if (!signed) return [];
		const by: Record<string, Signed['panels']> = {};
		for (const p of signed.panels ?? []) (by[p.group || 'Plugins'] ??= []).push(p);
		return Object.entries(by);
	});
	const activePanel = $derived(
		data.route.view === 'panel' ? `${data.route.plugin}/${data.route.panel}` : undefined,
	);
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

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && navOpen) {
			e.preventDefault();
			closeNav(true);
		}
	}}
/>

<div
	class="kitcms-admin"
	style:--kc-accent={data.branding.colors.accent}
	style:--kc-accent-text={data.branding.colors.accentText}
>
	{#if data.route.view === 'login'}
		<Login title={data.title} logo={data.branding.logo} message={form?.message} emailEnabled={as('login')?.emailEnabled} />
	{:else if data.route.view === 'forgot-password'}
		<ForgotPassword
			title={data.title}
			logo={data.branding.logo}
			message={form?.message}
			sent={form?.resetRequested === true}
			emailEnabled={as('forgot-password')?.emailEnabled ?? false}
		/>
	{:else if data.route.view === 'reset-password'}
		<ResetPassword
			title={data.title}
			logo={data.branding.logo}
			message={form?.message}
			token={as('reset-password')?.token ?? ''}
			link={as('reset-password')?.link ?? null}
		/>
	{:else if data.route.view === 'create-first-user'}
		<FirstUser title={data.title} logo={data.branding.logo} message={form?.message} />
	{:else if signed}
		<div class="shell">
			<header class="top">
				<button
					class="kc-btn kc-btn--ghost menu"
					aria-expanded={navOpen}
					aria-controls="kc-nav"
					bind:this={menuBtn}
					onclick={toggleNav}>Menu</button
				>
				<a class="brand" href={adminHref('')}>
					{#if data.branding.logo}<img class="logo" src={data.branding.logo} alt={data.title} />{/if}
					{data.title}
				</a>
				<span class="spacer"></span>
				<span class="who" data-testid="whoami">{signed.user.email}</span>
				<form method="POST" action="?/logout" use:enhance>
					<button class="kc-btn kc-btn--ghost">Log out</button>
				</form>
			</header>
			{#if navOpen}
				<!-- Mobile only (hidden by CSS on desktop): tapping outside the drawer closes it. -->
				<button type="button" class="backdrop" tabindex="-1" aria-label="Dismiss navigation" onclick={() => closeNav(true)}></button>
			{/if}
			<nav
				id="kc-nav"
				class="nav"
				data-open={navOpen}
				aria-label="Main"
				bind:this={navEl}
				onfocusout={onNavFocusOut}
			>
				<a
					href={adminHref('')}
					aria-current={data.route.view === 'dashboard' ? 'page' : undefined}
					onclick={() => closeNav()}>Dashboard</a
				>
				{#each groups as [group, items] (group)}
					{#if group}<span class="group">{group}</span>{/if}
					{#each items as item (item.slug)}
						<a
							href={collectionHref(item.slug)}
							aria-current={item.slug === activeSlug ? 'page' : undefined}
							onclick={() => closeNav()}>{item.label}</a
						>
					{/each}
				{/each}
				{#if signed.globals.length > 0}
					<span class="group">Globals</span>
					{#each signed.globals as item (item.slug)}
						<a
							href={globalHref(item.slug)}
							aria-current={item.slug === activeGlobal ? 'page' : undefined}
							onclick={() => closeNav()}>{item.label}</a
						>
					{/each}
				{/if}
				{#each panelGroups as [group, items] (group)}
					<span class="group">{group}</span>
					{#each items as item (item.plugin + '/' + item.id)}
						<a
							href={panelHref(item.plugin, item.id)}
							aria-current={`${item.plugin}/${item.id}` === activePanel ? 'page' : undefined}
							onclick={() => closeNav()}>{item.label}</a
						>
					{/each}
				{/each}
			</nav>
			<main class="content">
				{#if data.readOnly}
					<p class="kc-alert read-only" role="status" data-testid="read-only">This website is paused, so changes are switched off. You can still look around.</p>
				{/if}
				{#if dashboard}
					<Dashboard data={dashboard} />
				{:else if list}
					{#key viewKey}<List data={list} />{/key}
				{:else if editing}
					{#key viewKey}<Edit data={editing} {form} {admin} />{/key}
				{:else if versions}
					<Versions data={versions} {form} />
				{:else if panel}
					<Panel data={panel} />
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
	.backdrop {
		display: none;
	}
	@media (max-width: 800px) {
		.backdrop {
			display: block;
		}
		.shell {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'top'
				'content';
			grid-template-rows: auto 1fr;
		}
		.top {
			position: sticky;
			top: 0;
			z-index: 50;
			min-height: 3.5rem;
			padding-inline: 0.5rem;
		}
		.menu {
			display: inline-flex;
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
		.brand {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.who {
			display: none;
		}
		/* The nav becomes a drawer under the header. */
		.nav {
			position: fixed;
			z-index: 45;
			top: 3.5rem;
			bottom: 0;
			left: 0;
			width: min(18rem, 85vw);
			overflow-y: auto;
			overscroll-behavior: contain;
			border-right: 1px solid var(--kc-border);
			box-shadow: 0 8px 24px rgb(0 0 0 / 0.2);
		}
		.nav a {
			display: flex;
			align-items: center;
			min-height: 2.75rem;
		}
		.nav[data-open='false'] {
			display: none;
		}
		.backdrop {
			position: fixed;
			z-index: 44;
			inset: 3.5rem 0 0 0;
			border: 0;
			padding: 0;
			background: rgb(0 0 0 / 0.4);
			cursor: default;
		}
		.content {
			padding: 1rem 0.75rem;
		}
	}
</style>
