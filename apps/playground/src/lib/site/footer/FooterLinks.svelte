<script lang="ts">
	// The footer's link lists, shared by the three designs. The `id` target is what the no-script menu
	// link jumps to, so it must stay on whichever list holds the main navigation.
	import Link from '../Link.svelte';
	import type { Shell } from '../shell';

	let { shell, which, id }: { shell: Shell; which: 'nav' | 'legal' | 'social'; id?: string } = $props();
</script>

{#if which === 'nav'}
	<nav aria-label="Footer" {id}>
		<ul>
			{#each shell.nav as item (item.id)}<li><Link href={item.href}>{item.label}</Link></li>{/each}
		</ul>
	</nav>
{:else if which === 'legal'}
	<ul>
		{#each shell.legal as l (l.slug)}<li><Link href={`/legal/${l.slug}`}>{l.title}</Link></li>{/each}
		<li><Link href="/credits">Photo credits</Link></li>
	</ul>
{:else}
	<ul>
		{#each shell.social as s (s.id)}<li><Link href={s.url}>{s.label}</Link></li>{/each}
	</ul>
{/if}

<style>
	ul {
		list-style: none;
		display: grid;
		gap: 0;
	}
	li :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		text-decoration: none;
	}
	li :global(a:hover) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.25em;
	}
</style>
