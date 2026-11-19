<script lang="ts">
	// Read-only plugin panel (Decision 33).
	import type { AdminDataOf } from '@kitcms/core/client';
	import PanelBlocks from './PanelBlocks.svelte';

	let { data }: { data: AdminDataOf<'panel'> } = $props();
</script>

<h1>{data.panel.label}</h1>
<PanelBlocks content={data.panel.content} />
