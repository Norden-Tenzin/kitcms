<script lang="ts">
	import Link from './Link.svelte';
	import type { Shell } from './shell';

	let { shell }: { shell: Shell } = $props();
</script>

<footer class="footer">
	<div class="container">
		<div class="columns">
			{#each shell.columns as column (column.id)}
				<nav aria-label={column.title}>
					<h2>{column.title}</h2>
					<ul>
						{#each column.links as link (link.id)}
							<li><Link href={link.href}>{link.label}</Link></li>
						{/each}
					</ul>
				</nav>
			{/each}
		</div>
		{#if shell.note}<p class="note muted">{shell.note}</p>{/if}
	</div>
</footer>

<style>
	.footer {
		margin-top: var(--section);
		padding-block: 2rem;
		border-top: 1px solid var(--line);
	}
	.columns {
		display: grid;
		gap: 1.5rem;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
	}
	h2 {
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		text-decoration: none;
	}
	li :global(a:hover) {
		text-decoration: underline;
	}
	.note {
		margin: 1.5rem 0 0;
		font-size: 0.9375rem;
	}
</style>
