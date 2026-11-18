<script lang="ts">
	import ServicesList from '#lib/site/pages/ServicesList.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
	const description = 'Brand identity, websites, product design and photography, from a four-person studio in Bengaluru.';
</script>

<Seo title="Services" {description} siteName={data.site.siteName} />
<ServicesList services={data.services} design={data.design} />
