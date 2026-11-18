<script lang="ts">
	import { page } from '$app/state';
	import Link from '#lib/Link.svelte';
</script>

<svelte:head><title>{page.status}</title></svelte:head>

<div class="container wrap">
	<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="muted lead">
		{page.status === 404 ? 'That page does not exist or is not published.' : page.error?.message}
	</p>
	<Link href="/" class="btn">Back to the home page</Link>
</div>

<style>
	.wrap {
		padding-block: var(--section);
	}
	h1 {
		font-size: var(--step-h2);
	}
</style>
