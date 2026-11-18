<script lang="ts">
	import { page } from '$app/state';
	import Link from '#lib/site/Link.svelte';
</script>

<svelte:head><title>{page.status}</title></svelte:head>

<div class="container wrap">
	<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="lead muted">
		{page.status === 404 ? 'That page does not exist or is not published.' : page.error?.message}
	</p>
	<Link href="/" class="btn">Back to the home page</Link>
</div>

<style>
	.wrap {
		display: grid;
		gap: var(--s-4);
		justify-items: start;
		padding-block: var(--s-5) var(--section);
	}
	h1 {
		font-size: var(--step-h2);
	}
</style>
