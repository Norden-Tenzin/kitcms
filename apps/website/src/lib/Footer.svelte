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
		{#if shell.note}<p class="note">{shell.note}</p>{/if}
	</div>
	<p class="mark" aria-hidden="true">{shell.siteName}</p>
</footer>

<style>
	.footer {
		margin-top: 0;
		padding-top: clamp(3rem, 2rem + 4vw, 5.5rem);
		overflow: hidden;
		background: var(--surface);
	}
	.columns {
		display: grid;
		gap: 2rem 1.5rem;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.0625rem;
		letter-spacing: -0.01em;
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
		color: var(--muted);
		text-decoration: none;
	}
	li :global(a:hover) {
		color: var(--fg);
		text-decoration: underline;
	}
	.note {
		max-width: var(--measure);
		margin: 2rem 0 0;
		color: var(--muted);
		font-size: 0.9375rem;
	}
	/* The name returns at full width, as a closing mark. */
	.mark {
		margin: clamp(1.5rem, 1rem + 3vw, 3.5rem) 0 0;
		padding-inline: var(--gutter);
		max-width: var(--max);
		margin-inline: auto;
		font-size: clamp(4rem, 22vw, 17rem);
		font-weight: 800;
		letter-spacing: -0.06em;
		line-height: 0.8;
		white-space: nowrap;
		overflow: hidden;
		color: var(--surface-2);
		user-select: none;
		translate: 0 0.12em;
	}
</style>
