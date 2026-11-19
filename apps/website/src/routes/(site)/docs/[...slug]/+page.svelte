<script lang="ts">
	import Link from '#lib/Link.svelte';
	import { GITHUB } from '#lib/site-defaults.ts';

	let { data } = $props();
	const page = $derived(data.page);
	const toc = $derived(page.toc);

	let article: HTMLElement | undefined = $state();

	// Adds a copy button to every code block. The HTML is rendered at build time, so this is a
	// progressive enhancement: without script the blocks simply have no button.
	$effect(() => {
		void page.html;
		const root = article;
		if (!root) return;
		const cleanups: (() => void)[] = [];
		for (const block of root.querySelectorAll<HTMLElement>('.code-block')) {
			const code = block.querySelector('pre code');
			if (!code) continue;
			const actions = document.createElement('div');
			actions.className = 'code-actions';
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'copy-btn';
			button.textContent = 'Copy';
			button.setAttribute('aria-label', 'Copy code');
			let timer: ReturnType<typeof setTimeout> | undefined;
			button.addEventListener('click', async () => {
				try {
					await navigator.clipboard.writeText(code.textContent ?? '');
					button.textContent = 'Copied';
					clearTimeout(timer);
					timer = setTimeout(() => (button.textContent = 'Copy'), 2000);
				} catch {
					// Clipboard blocked: the code stays selectable.
				}
			});
			actions.appendChild(button);
			block.appendChild(actions);
			cleanups.push(() => {
				clearTimeout(timer);
				actions.remove();
			});
		}
		return () => cleanups.forEach((fn) => fn());
	});
</script>

<svelte:head>
	<title>{page.title} | kitcms docs</title>
	{#if page.description}<meta name="description" content={page.description} />{/if}
</svelte:head>

<div class="with-toc">
	<article class="doc" bind:this={article}>
		<h1>{page.title}</h1>
		{#if page.description}<p class="lead">{page.description}</p>{/if}

		{#if toc.length > 1}
			<details class="toc-m">
				<summary>On this page</summary>
				<ul>
					{#each toc as item (item.id)}
						<li class:sub={item.depth === 3}><a href="#{item.id}">{item.text}</a></li>
					{/each}
				</ul>
			</details>
		{/if}

		<!-- Safe: rendered at build time from the markdown files in this repository (not user input). -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html page.html}

		<p class="edit">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="{GITHUB}/edit/main/{page.file}" rel="noopener">Edit this page on GitHub</a>
		</p>

		{#if page.prev || page.next}
			<nav class="pager" aria-label="Previous and next page">
				{#if page.prev}
					<Link href={page.prev.path} class="prev"><span class="dir">Previous</span>{page.prev.title}</Link>
				{/if}
				{#if page.next}
					<Link href={page.next.path} class="next"><span class="dir">Next</span>{page.next.title}</Link>
				{/if}
			</nav>
		{/if}
	</article>

	{#if toc.length > 1}
		<aside class="toc-d" aria-label="On this page">
			<h2>On this page</h2>
			<ul>
				{#each toc as item (item.id)}
					<li class:sub={item.depth === 3}><a href="#{item.id}">{item.text}</a></li>
				{/each}
			</ul>
		</aside>
	{/if}
</div>

<style>
	.with-toc {
		display: block;
	}
	.toc-d {
		display: none;
	}
	.toc-m {
		margin-bottom: 2rem;
		border-radius: var(--radius);
		background: var(--surface);
	}
	.toc-m summary {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 1rem;
		font-weight: 650;
		cursor: pointer;
	}
	.toc-m ul {
		margin: 0;
		padding: 0 1rem 0.75rem;
		list-style: none;
	}
	ul a {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--muted);
		text-decoration: none;
	}
	ul a:hover {
		color: var(--fg);
	}
	li.sub a {
		padding-left: 1rem;
	}
	.edit {
		margin-top: 3rem;
		font-size: 0.9375rem;
	}
	.edit a {
		color: var(--muted);
	}
	.pager {
		display: grid;
		gap: 0.75rem;
		margin-top: 2rem;
	}
	.pager :global(a) {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 4rem;
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem;
		background: var(--surface);
		color: var(--fg);
		font-weight: 650;
		text-decoration: none;
	}
	.pager :global(a:hover) {
		background: var(--surface-2);
	}
	.pager :global(.next) {
		text-align: right;
	}
	.dir {
		color: var(--muted);
		font-size: 0.875rem;
		font-weight: 500;
	}
	@media (min-width: 48rem) {
		.pager {
			grid-template-columns: 1fr 1fr;
		}
		.pager :global(.next:only-child) {
			grid-column: 2;
		}
	}
	@media (min-width: 80rem) {
		.with-toc {
			display: grid;
			grid-template-columns: minmax(0, 72ch) 13rem;
			gap: 3rem;
			align-items: start;
		}
		.toc-m {
			display: none;
		}
		.toc-d {
			display: block;
			position: sticky;
			top: calc(var(--header-h) + 3rem);
		}
		.toc-d h2 {
			margin: 0 0 0.5rem;
			font-size: 0.9375rem;
			letter-spacing: 0;
		}
		.toc-d ul {
			margin: 0;
			padding: 0;
			list-style: none;
			font-size: 0.9375rem;
		}
		.toc-d ul a {
			min-height: 2rem;
		}
	}
</style>
