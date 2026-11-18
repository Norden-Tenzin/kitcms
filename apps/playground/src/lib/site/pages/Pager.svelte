<script lang="ts">
	// Newer / older links for a paged list. Keeps the active tag in the URL.
	interface Props {
		page: number;
		totalPages: number;
		tag?: string | null;
		base?: string;
	}
	let { page, totalPages, tag = null, base = '/journal' }: Props = $props();
	const href = (n: number) => {
		const q = [tag ? `tag=${encodeURIComponent(tag)}` : '', n > 1 ? `page=${n}` : ''].filter(Boolean).join('&');
		return q ? `${base}?${q}` : base;
	};
</script>

<!-- Internal links and anchors are plain paths built here, not routes to resolve. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

{#if totalPages > 1}
	<nav class="pager" aria-label="Pages">
		{#if page > 1}<a class="btn ghost" href={href(page - 1)} rel="prev">Newer</a>{:else}<span></span>{/if}
		<p class="small" aria-current="page">Page {page} of {totalPages}</p>
		{#if page < totalPages}<a class="btn ghost" href={href(page + 1)} rel="next">Older</a>{:else}<span></span>{/if}
	</nav>
{/if}

<style>
	.pager {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--s-4);
		margin-top: var(--s-7);
	}
</style>
