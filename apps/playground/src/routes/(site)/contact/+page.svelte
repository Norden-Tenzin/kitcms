<script lang="ts">
	import ContactPage from '#lib/site/pages/ContactPage.svelte';
	import Seo from '#lib/site/Seo.svelte';
	import { buildShell } from '#lib/site/shell.ts';

	let { data } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
</script>

<Seo title="Contact" description="Send us a brief or write to us. We reply within one working day." siteName={data.site.siteName} />
<ContactPage {shell} design={data.design} />
