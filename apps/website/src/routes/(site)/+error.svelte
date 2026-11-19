<script lang="ts">
	import { page } from '$app/state';
	import Link from '#lib/Link.svelte';
</script>

<svelte:head><title>{page.status}</title></svelte:head>

<div class="container wrap">
	<p class="code" aria-hidden="true">{page.status}</p>
	<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="lead">
		{page.status === 404 ? 'That page does not exist or is not published.' : page.error?.message}
	</p>
	<Link href="/" class="btn">Back to the home page</Link>
</div>

<style>
	.wrap {
		padding-block: var(--section);
	}
	.code {
		margin: 0;
		color: var(--accent);
		font-size: clamp(5rem, 3rem + 14vw, 12rem);
		font-weight: 800;
		letter-spacing: -0.06em;
		line-height: 0.85;
	}
	h1 {
		margin-top: 1rem;
		font-size: clamp(2rem, 1.2rem + 3vw, 3.5rem);
	}
	.lead {
		max-width: 32rem;
	}
</style>
