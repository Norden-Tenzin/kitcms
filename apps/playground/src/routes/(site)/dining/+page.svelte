<script lang="ts">
	import PageHead from '#lib/site/PageHead.svelte';
	import Section from '#lib/site/Section.svelte';
	import Seo from '#lib/site/Seo.svelte';

	// Placeholder menu (part 3 builds the three dining designs; `data.design` is already resolved).
	let { data } = $props();
	const COURSES = ['breakfast', 'lunch', 'dinner', 'drinks'] as const;
	const groups = $derived(COURSES.map((c) => [c, data.dishes.filter((d) => d.course === c)] as const).filter(([, l]) => l.length));
</script>

<Seo title="Dining" description="Ladakhi breakfast, and dinner on request." siteName={data.site.siteName} />
<PageHead title="Dining" lead="A Ladakhi breakfast every morning. Dinner on request, cooked in the family kitchen. Tell us by noon." />
<Section pad="none">
	<div class="menu" data-design={data.design}>
		{#each groups as [course, list] (course)}
			<div class="course">
				<h2>{course}</h2>
				<ul>
					{#each list as d (d.id)}
						<li><strong>{d.name}</strong>{#if d.ladakhi}<span class="small"> Ladakhi</span>{/if}{#if d.vegetarian}<span class="small"> Vegetarian</span>{/if}<p class="small">{d.description}</p></li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</Section>

<style>
	.menu {
		display: grid;
		gap: var(--s-7);
		padding-top: var(--s-5);
	}
	h2 {
		text-transform: capitalize;
		margin-bottom: var(--s-4);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-3);
	}
	@media (min-width: 56rem) {
		.menu {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
