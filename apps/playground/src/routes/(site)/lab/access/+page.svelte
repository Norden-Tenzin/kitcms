<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();

	// Public pages never resolve the session (the site stays cacheable), so the page above always acts
	// as a visitor. The REST API does resolve it: this reads the same collection with your session cookie.
	let mine = $state<{ status: 'loading' | 'done' | 'denied'; titles: string[] }>({ status: 'loading', titles: [] });
	onMount(async () => {
		try {
			const res = await fetch('/api/collections/notes?limit=100');
			if (!res.ok) throw new Error(String(res.status));
			const body = (await res.json()) as { docs: { title?: string; visibility?: string }[] };
			mine = { status: 'done', titles: body.docs.map((n) => `${n.title} (${n.visibility})`) };
		} catch {
			mine = { status: 'denied', titles: [] };
		}
	});
</script>

<h1>Access</h1>
<p>
	This page reads as <strong>an anonymous visitor</strong>, whoever you are: public pages never look at your session.
</p>

<h2>Notes you can read: <span data-testid="note-count">{data.notes.length}</span></h2>
<p class="muted">
	The <code>notes</code> collection's <code>read</code> access returns a <code>where</code> for anonymous visitors
	({'{ visibility: { equals: "public" } }'}), so they only get public notes. Signed-in users get all of them (see below).
</p>
{#if data.notes.length}
	<ul data-testid="notes">
		{#each data.notes as n (n.id)}
			<li>{n.title} <span class="muted">({n.visibility})</span></li>
		{/each}
	</ul>
{:else}
	<p class="muted">No notes you can read.</p>
{/if}

<h2>The same collection as you, over REST</h2>
<p class="muted">Fetched in your browser from <code>/api/collections/notes</code> with your session cookie, if you have one.</p>
{#if mine.status === 'loading'}
	<p class="muted">Loading...</p>
{:else if mine.status === 'denied'}
	<p class="muted">Not allowed.</p>
{:else}
	<p>Notes you can read: <span data-testid="my-note-count">{mine.titles.length}</span></p>
	<ul data-testid="my-notes">
		{#each mine.titles as t (t)}<li>{t}</li>{/each}
	</ul>
{/if}

<h2>Field access</h2>
<p>
	Reading <code>internalNote</code> on
	{data.sampleTitle ? `"${data.sampleTitle}"` : 'a field sample'} as this visitor:
</p>
<p data-testid="internal-note">
	{#if data.sampleTitle === null}
		<span class="muted">No field sample exists yet.</span>
	{:else if data.internalNote === null}
		<em>hidden from visitors</em> (the field is dropped from the result)
	{:else}
		<strong>{data.internalNote || '(empty)'}</strong>
	{/if}
</p>
