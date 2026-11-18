<script lang="ts">
	import PageHead from '#lib/site/PageHead.svelte';
	import ExperienceCards from '#lib/site/pages/ExperienceCards.svelte';
	import Seo from '#lib/site/Seo.svelte';

	let { data } = $props();
</script>

<Seo title="Experiences" description="Monastery mornings, high passes and slow days around Leh, arranged by the house." siteName={data.site.siteName} />
<PageHead title="Experiences" lead="Monastery mornings, high passes and slow days. We arrange the car and the driver, you bring the sun hat." />
<div class="container body"><ExperienceCards items={data.items} design={data.design} /></div>

<style>
	.body {
		padding-top: var(--s-5);
		padding-bottom: var(--s-7);
	}
</style>
