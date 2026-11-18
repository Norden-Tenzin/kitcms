<script lang="ts">
	// "All topics" plus one link per tag; the choice lives in the URL (`?tag=`) so it works without
	// script, can be shared and is filtered on the server.
	interface Props {
		tags: { name: string; slug: string }[];
		active: string | null;
		/** `row` wraps inline, `column` stacks (for a sidebar). */
		layout?: 'row' | 'column';
		onDark?: boolean;
	}
	let { tags, active, layout = 'row', onDark = false }: Props = $props();
</script>

<!-- Internal links and anchors are plain paths built here, not routes to resolve. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<nav aria-label="Filter by topic" class={['filter', layout, onDark && 'on-dark']}>
	<ul>
		<li><a href="/journal" aria-current={active ? undefined : 'page'}>All</a></li>
		{#each tags as t (t.slug)}
			<li><a href={`/journal?tag=${encodeURIComponent(t.slug)}`} aria-current={active === t.slug ? 'page' : undefined}>{t.name}</a></li>
		{/each}
	</ul>
</nav>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-5);
	}
	.column ul {
		flex-direction: column;
		gap: 0;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		text-decoration: none;
		font-weight: 600;
		color: var(--muted);
		border-bottom: 3px solid transparent;
	}
	.on-dark a {
		color: inherit;
		opacity: 0.8;
	}
	a:hover {
		color: var(--ink);
		border-bottom-color: color-mix(in srgb, currentColor 40%, transparent);
	}
	.on-dark a:hover {
		color: inherit;
		opacity: 1;
	}
	a[aria-current='page'] {
		color: var(--ink);
		border-bottom-color: var(--accent);
	}
	.on-dark a[aria-current='page'] {
		color: inherit;
		opacity: 1;
		border-bottom-color: var(--apricot);
	}
	.column a {
		border-bottom: 0;
		border-left: 3px solid transparent;
		padding-left: var(--s-3);
	}
	.column a[aria-current='page'] {
		border-left-color: var(--accent);
	}
</style>
