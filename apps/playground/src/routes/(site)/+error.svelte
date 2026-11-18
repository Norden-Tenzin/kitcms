<script lang="ts">
	import { page } from '$app/state';
	import Link from '#lib/site/Link.svelte';
	import PageHead from '#lib/site/PageHead.svelte';
</script>

<PageHead title={page.status === 404 ? 'Not found' : 'Something went wrong'} lead={page.error?.message} />
<div class="container"><Link href="/" class="btn">Back to the home page</Link></div>
