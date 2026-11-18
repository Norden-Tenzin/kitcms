<script lang="ts">
	import Seo from '#lib/site/Seo.svelte';
	import WorkList from '#lib/site/pages/WorkList.svelte';

	let { data } = $props();
</script>

<Seo
	title="Work"
	description="Selected projects: brand identities, websites, products and photography."
	siteName={data.site.siteName}
	noIndex={data.active !== null}
/>
<WorkList projects={data.projects} filters={data.filters} active={data.active} design={data.design} />
