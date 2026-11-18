<script lang="ts">
	import Link from '../Link.svelte';
	import type { Shell } from '../shell';

	let { shell }: { shell: Shell } = $props();
	const a = $derived(shell.announcement);
</script>

{#if a}
	<div class="bar on-dark" role="region" aria-label="Announcement">
		<div class="container">
			{#if a.link}<Link href={a.link}>{a.text}</Link>{:else}<p>{a.text}</p>{/if}
		</div>
	</div>
{/if}

<style>
	.bar {
		background: var(--earth);
		color: var(--earth-ink);
		font-size: var(--step-small);
		text-align: center;
	}
	.bar :global(a),
	p {
		display: block;
		padding: 0.6rem 0;
		font-weight: 500;
	}
</style>
