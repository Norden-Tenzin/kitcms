<script lang="ts">
	import { page } from '$app/state';
	import { roomLd } from '#lib/site/jsonld.ts';
	import { metaOf } from '#lib/site/meta.ts';
	import { asMedia } from '#lib/site/media.ts';
	import RoomPlan from '#lib/site/pages/RoomPlan.svelte';
	import RoomThreshold from '#lib/site/pages/RoomThreshold.svelte';
	import RoomWindow from '#lib/site/pages/RoomWindow.svelte';
	import Seo from '#lib/site/Seo.svelte';
	import { buildShell } from '#lib/site/shell.ts';

	let { data } = $props();
	const shell = $derived(buildShell(data.site, data.legal));
	const meta = $derived(metaOf(data.room));
</script>

<Seo
	title={meta.title || data.room.name}
	description={meta.description || data.room.summary}
	image={meta.image ?? asMedia(data.room.cover)}
	noIndex={meta.noIndex}
	siteName={data.site.siteName}
	jsonLd={[roomLd(data.room, shell, page.url.origin)]}
/>
{#if data.design === 'b'}
	<RoomWindow room={data.room} others={data.others} {shell} />
{:else if data.design === 'c'}
	<RoomPlan room={data.room} others={data.others} {shell} />
{:else}
	<RoomThreshold room={data.room} others={data.others} {shell} />
{/if}
