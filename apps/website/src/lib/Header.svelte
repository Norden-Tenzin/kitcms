<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Link from './Link.svelte';
	import { isActive, type Shell } from './shell';

	let { shell }: { shell: Shell } = $props();
</script>

<header class="header">
	<div class="container bar">
		<a href={resolve('/(site)')} class="brand">{shell.siteName}</a>
		<nav aria-label="Main">
			<ul>
				{#each shell.nav as item (item.id)}
					<li>
						<Link
							href={item.href}
							aria-current={isActive(item.href, page.url.pathname) ? 'page' : undefined}
						>
							{item.label}
						</Link>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
</header>

<style>
	.header {
		border-bottom: 1px solid var(--line);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0 1rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 700;
		text-decoration: none;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding-inline: 0.5rem;
		text-decoration: none;
	}
	li :global(a[aria-current='page']) {
		text-decoration: underline;
		text-decoration-color: var(--accent);
	}
</style>
