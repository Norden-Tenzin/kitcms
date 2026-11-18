<script lang="ts">
	// A thin bar above the header, set in Site settings > General > Announcement. Off by default.
	import Link from '../Link.svelte';
	import type { Shell } from '../shell';

	let { shell }: { shell: Shell } = $props();
	const a = $derived(shell.announcement);
</script>

{#if a}
	<div class="bar inverse">
		<div class="container inner">
			<p class="small">
				{#if a.link}<Link href={a.link} class="link">{a.text}</Link>{:else}{a.text}{/if}
			</p>
		</div>
	</div>
{/if}

<style>
	.inner {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 2.5rem;
		padding-block: 0.4rem;
		text-align: center;
	}
</style>
