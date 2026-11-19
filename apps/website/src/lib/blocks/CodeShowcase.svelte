<script lang="ts">
	import '../site.css';
	import { highlight } from '../highlight';
	import Img from '../Img.svelte';
	import { asMedia } from '../media';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'codeShowcase'> } = $props();
	const image = $derived(asMedia(block.image));
	const language = $derived(block.language ?? 'ts');
	// Safe for {@html}: `highlight` escapes every character of the (CMS) input.
	const html = $derived(highlight(block.code, language));

	const humanize = (key: string) =>
		key
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.replace(/^./, (c) => c.toUpperCase());

	// The empty state mocks an admin edit form from the snippet's own fields (`name: f.type(`).
	type Field = { label: string; type: string };
	const fields = $derived.by((): Field[] => {
		const found: Field[] = [];
		for (const m of (block.code ?? '').matchAll(/^\s*(\w+):\s*f\.(\w+)\(/gm)) {
			found.push({ label: humanize(m[1]!), type: m[2]! });
		}
		return found.slice(0, 5);
	});
</script>

<section class="section tone-dark showcase">
	<div class="container">
		<header>
			{#if block.title}<h2>{block.title}</h2>{/if}
			{#if block.text}<p class="lead">{block.text}</p>{/if}
		</header>
		<div class="pair">
			<figure class="code">
				{#if block.filename}<figcaption class="filename">{block.filename}</figcaption>{/if}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<pre tabindex="0"><code class="language-{language}">{@html html}</code></pre>
			</figure>
			<figure class="shot">
				{#if image}
					<Img media={image} widths={[640, 1000, 1400]} sizes="(min-width: 64rem) 40vw, 100vw" />
				{:else}
					<div class="mock" role="img" aria-label={block.caption || 'Admin edit form'}>
						<div class="mock-bar" aria-hidden="true">
							<span class="crumb">Edit</span>
							<span class="mock-actions">
								<span class="mbtn ghost">Save draft</span>
								<span class="mbtn">Publish</span>
							</span>
						</div>
						<div class="mock-body" aria-hidden="true">
							{#each fields.length ? fields : [{ label: 'Title', type: 'text' }, { label: 'Slug', type: 'slug' }, { label: 'Published at', type: 'date' }, { label: 'Body', type: 'richText' }] as f (f.label)}
								<div class="mfield">
									<span class="mlabel">{f.label}</span>
									{#if f.type === 'richText'}
										<span class="minput editor">
											<span class="tools"><b>B</b><i>I</i><u>Link</u></span>
											<span class="line"></span>
											<span class="line short"></span>
											<span class="line"></span>
										</span>
									{:else if f.type === 'date'}
										<span class="minput inline"><span class="line short"></span><span class="cal"></span></span>
									{:else}
										<span class="minput"><span class="line" class:short={f.type === 'slug'}></span></span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
				{#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
			</figure>
		</div>
	</div>
</section>

<style>
	header {
		margin-bottom: clamp(2rem, 1rem + 3vw, 3.5rem);
	}
	header :global(.lead) {
		max-width: 36rem;
	}
	.pair {
		display: grid;
		gap: 2rem;
	}
	figure {
		margin: 0;
		min-width: 0;
	}
	.filename {
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem 0.75rem 0 0;
		background: var(--surface-2);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--muted);
		overflow-wrap: anywhere;
	}
	pre {
		margin: 0;
		overflow-x: auto;
		padding: 1.25rem;
		border-radius: 0 0 0.75rem 0.75rem;
		background: var(--code-bg);
		color: var(--tok-punct);
		font-size: 0.875rem;
		line-height: 1.65;
		tab-size: 2;
	}
	.code :global(pre:only-child) {
		border-radius: 0.75rem;
	}
	.shot :global(img) {
		width: 100%;
		height: auto;
		border-radius: 0.75rem;
	}
	figcaption:not(.filename) {
		margin-top: 0.75rem;
		font-size: 0.9375rem;
		color: var(--muted);
	}

	/* ---- Admin form mock (empty state) ---- */
	.mock {
		overflow: hidden;
		border-radius: 0.75rem;
		background: var(--surface);
	}
	.mock-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface-2);
	}
	.crumb {
		font-weight: 650;
		font-size: 0.9375rem;
	}
	.mock-actions {
		display: flex;
		gap: 0.5rem;
	}
	.mbtn {
		padding: 0.3rem 0.9rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.8125rem;
		font-weight: 650;
	}
	.mbtn.ghost {
		background: var(--surface);
		color: var(--fg);
	}
	.mock-body {
		display: grid;
		gap: 1rem;
		padding: 1.25rem 1rem 1.5rem;
	}
	.mfield {
		display: grid;
		gap: 0.35rem;
	}
	.mlabel {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted);
	}
	.minput {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background: var(--code-bg);
	}
	.minput .line {
		display: block;
		width: 70%;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--surface-2);
	}
	.minput .line.short {
		width: 35%;
	}
	.minput.inline {
		justify-content: space-between;
	}
	.cal {
		width: 1rem;
		height: 1rem;
		border-radius: 0.2rem;
		background: var(--surface-2);
	}
	.minput.editor {
		flex-direction: column;
		align-items: stretch;
		gap: 0.6rem;
		min-height: 7.5rem;
		padding: 0.5rem 0.75rem 0.9rem;
	}
	.editor .tools {
		display: flex;
		gap: 1rem;
		padding-bottom: 0.4rem;
		color: var(--muted);
		font-size: 0.8125rem;
	}
	.editor .line {
		width: 100%;
	}
	.editor .line.short {
		width: 55%;
	}
	@media (min-width: 64rem) {
		.pair {
			grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
			align-items: start;
		}
	}
</style>
