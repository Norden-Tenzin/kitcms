<script lang="ts">
	import type { RichTextDoc } from '@kitcms/core';
	import RenderBlocks from '#lib/site/blocks/RenderBlocks.svelte';
	import Img from '#lib/site/Img.svelte';
	import Link from '#lib/site/Link.svelte';
	import { asDoc, asMedia, asMediaList } from '#lib/site/media.ts';
	import RichText from '#lib/site/RichText.svelte';
	import type { PageBlock } from '#lib/site/types.ts';

	let { data } = $props();
	const d = $derived(data.doc);

	const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
	const group = $derived((d.address ?? {}) as { line?: string; city?: string; postcode?: string });
	const advanced = $derived((d.advanced ?? {}) as { notes?: string; score?: number });
	const links = $derived(Array.isArray(d.links) ? (d.links as { id?: string; label?: string; href?: string }[]) : []);
	const sections = $derived((Array.isArray(d.sections) ? d.sections : []) as PageBlock[]);
	const images = $derived(asMediaList(d.images));
	const post = $derived(asDoc<{ id: string; title?: string; slug?: string }>(d.post));
	const tags = $derived(
		(Array.isArray(d.tags) ? d.tags : []).map((t) => asDoc<{ id: string; name?: string }>(t)).filter((t) => t !== null),
	);
	const hasInternal = $derived('internalNote' in d && d.internalNote !== undefined);
</script>

<p><Link href="/lab/fields">&larr; All documents</Link></p>
<h1>{d.title}</h1>

<h2>Sidebar and simple fields</h2>
<dl>
	<dt>title (text)</dt>
	<dd>{str(d.title) ?? '(empty)'}</dd>
	<dt>slug</dt>
	<dd>{str(d.slug) ?? '(empty)'}</dd>
	<dt>status (select)</dt>
	<dd>{str(d.status) ?? '(empty)'}</dd>
	<dt>featured (checkbox)</dt>
	<dd>{d.featured ? 'yes' : 'no'}</dd>
	<dt>due (date)</dt>
	<dd>{str(d.due) ?? '(empty)'}</dd>
	<dt>summary (textarea)</dt>
	<dd>{str(d.summary) ?? '(empty)'}</dd>
	<dt>email</dt>
	<dd>{str(d.email) ?? '(empty)'}</dd>
	<dt>count (integer)</dt>
	<dd>{str(d.count) ?? '(empty)'}</dd>
	<dt>ratio (number)</dt>
	<dd>{str(d.ratio) ?? '(empty)'}</dd>
	<dt>website (text with validate)</dt>
	<dd>{str(d.website) ?? '(empty)'}</dd>
	<dt>doneNote (admin condition: status is done)</dt>
	<dd>{str(d.doneNote) ?? '(empty)'}</dd>
	<dt>internalNote (field access: signed-in only)</dt>
	<dd>
		{#if hasInternal}
			{str(d.internalNote) ?? '(empty)'}
		{:else}
			<em>hidden from visitors</em>
		{/if}
	</dd>
</dl>

<h2>Nested fields (JSON columns)</h2>
<dl>
	<dt>body (richText)</dt>
	<dd>{#if d.body}<RichText doc={d.body as RichTextDoc} />{:else}(empty){/if}</dd>
	<dt>settings (json)</dt>
	<dd>{#if d.settings !== null && d.settings !== undefined}<pre>{JSON.stringify(d.settings, null, 2)}</pre>{:else}(empty){/if}</dd>
	<dt>address (group with a row)</dt>
	<dd>
		line: {group.line || '(empty)'}<br />
		city: {group.city || '(empty)'}<br />
		postcode: {group.postcode || '(empty)'}
	</dd>
	<dt>links (array)</dt>
	<dd>
		{#if links.length}
			<ol>
				{#each links as l, i (l.id ?? i)}
					<li>{l.label} <span class="muted">{l.href}</span></li>
				{/each}
			</ol>
		{:else}(no rows){/if}
	</dd>
	<dt>advanced (collapsible)</dt>
	<dd>notes: {advanced.notes || '(empty)'}<br />score: {advanced.score ?? '(empty)'}</dd>
</dl>

<h2>Blocks</h2>
{#if sections.length}
	<div class="blocks"><RenderBlocks blocks={sections} design="a" /></div>
{:else}
	<p class="muted">(no blocks)</p>
{/if}

<h2>Relations</h2>
<dl>
	<dt>image (upload)</dt>
	<dd>{#if asMedia(d.image)}<div class="thumb"><Img media={asMedia(d.image)} widths={[320, 640]} sizes="20rem" /></div>{:else}(empty){/if}</dd>
	<dt>images (upload, hasMany)</dt>
	<dd>
		{#if images.length}
			<div class="thumbs">
				{#each images as m (m.id)}<div class="thumb"><Img media={m} widths={[240, 480]} sizes="12rem" /></div>{/each}
			</div>
		{:else}(empty){/if}
	</dd>
	<dt>post (relationship)</dt>
	<dd>
		{#if post}
			{#if post.slug}<Link href={`/blog/${post.slug}`}>{post.title}</Link>{:else}{post.title}{/if}
		{:else}(empty){/if}
	</dd>
	<dt>tags (relationship, hasMany)</dt>
	<dd>{tags.length ? tags.map((t) => t.name).join(', ') : '(empty)'}</dd>
</dl>

<style>
	dl {
		display: grid;
		gap: var(--s-3);
		margin: 0;
	}
	dt {
		font-size: var(--step-small);
		color: var(--muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	ol {
		margin: 0;
		padding-left: 1.25rem;
	}
	.thumbs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.thumb {
		max-width: 12rem;
	}
	.thumb :global(img) {
		max-width: 100%;
		height: auto;
	}
	.blocks {
		border: 1px solid var(--surface-2);
		overflow: hidden;
	}
</style>
