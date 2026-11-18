<script lang="ts">
	// Three footers (registry: `designs.ts`). A "Simple": name and text, links, one row.
	// B "Columns": name and text, then the pages, then social and legal links, on a tinted ground.
	// C "Statement": the site name set large on a dark ground, links under it.
	import Link from '../Link.svelte';
	import type { DesignId } from '../designs';
	import type { Shell } from './shell';

	let { shell, design }: { shell: Shell; design: DesignId } = $props();
	const year = new Date().getFullYear();
</script>

<footer data-design={design}>
	<div class="container">
		{#if design === 'c'}
			<p class="statement">{shell.siteName}</p>
			{#if shell.footerText}<p class="text lead">{shell.footerText}</p>{/if}
			<nav aria-label="Footer" class="links">
				{#each shell.nav as item (item.id)}<Link href={item.href}>{item.label}</Link>{/each}
				{#each shell.social as link (link.id)}<Link href={link.url}>{link.label}</Link>{/each}
				{#each shell.legal as doc (doc.slug)}<Link href={`/legal/${doc.slug}`}>{doc.title}</Link>{/each}
			</nav>
		{:else if design === 'b'}
			<div class="cols">
				<div>
					<p class="name">{shell.siteName}</p>
					{#if shell.footerText}<p class="text">{shell.footerText}</p>{/if}
				</div>
				<nav aria-label="Footer, pages">
					<h2>Pages</h2>
					{#each shell.nav as item (item.id)}<Link href={item.href}>{item.label}</Link>{/each}
				</nav>
				<nav aria-label="Footer, more">
					<h2>More</h2>
					{#each shell.social as link (link.id)}<Link href={link.url}>{link.label}</Link>{/each}
					{#each shell.legal as doc (doc.slug)}<Link href={`/legal/${doc.slug}`}>{doc.title}</Link>{/each}
				</nav>
			</div>
		{:else}
			<div class="row">
				<div>
					<p class="name">{shell.siteName}</p>
					{#if shell.footerText}<p class="text">{shell.footerText}</p>{/if}
				</div>
				<nav aria-label="Footer" class="links">
					{#each shell.social as link (link.id)}<Link href={link.url}>{link.label}</Link>{/each}
					{#each shell.legal as doc (doc.slug)}<Link href={`/legal/${doc.slug}`}>{doc.title}</Link>{/each}
				</nav>
			</div>
		{/if}
		<p class="copy">&copy; {year} {shell.siteName}</p>
	</div>
</footer>

<style>
	footer {
		padding-block: var(--s-6) var(--s-5);
		background: var(--surface);
		color: var(--ink);
		font-size: var(--step-small);
	}
	footer[data-design='c'] {
		background: var(--ink);
		color: var(--bg);
		--focus: var(--bg);
		padding-block: var(--section) var(--s-5);
	}
	p {
		margin: 0;
	}
	.name {
		font: 700 1.25rem/1.2 var(--font-display);
		letter-spacing: -0.02em;
	}
	.text {
		margin-top: var(--s-1);
		max-width: 30rem;
		color: var(--muted);
	}
	footer[data-design='c'] .text {
		color: color-mix(in srgb, var(--bg) 75%, var(--ink));
		max-width: 36rem;
		font-size: var(--step-lead);
	}
	h2 {
		margin: 0 0 var(--s-1);
		font: 650 var(--step-small) var(--font-sans);
		letter-spacing: 0;
		color: var(--muted);
	}
	nav :global(a),
	.links :global(a) {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		text-decoration: none;
	}
	nav :global(a:hover) {
		text-decoration: underline;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-4);
	}
	.cols {
		display: grid;
		gap: var(--s-5);
	}
	.cols nav {
		display: flex;
		flex-direction: column;
	}
	.statement {
		font: 700 clamp(3rem, 1rem + 11vw, 9.5rem) / 0.95 var(--font-display);
		letter-spacing: -0.04em;
		margin-bottom: var(--s-5);
		overflow-wrap: anywhere;
	}
	footer[data-design='c'] .links {
		margin-top: var(--s-5);
		font-size: var(--step-body);
	}
	.copy {
		margin-top: var(--s-5);
		color: var(--muted);
	}
	footer[data-design='c'] .copy {
		color: color-mix(in srgb, var(--bg) 65%, var(--ink));
	}
	@media (min-width: 48rem) {
		.row {
			flex-direction: row;
			justify-content: space-between;
			align-items: flex-start;
		}
		.cols {
			grid-template-columns: 2fr 1fr 1fr;
		}
	}
</style>
