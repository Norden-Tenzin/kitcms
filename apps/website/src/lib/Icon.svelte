<script lang="ts">
	import { ICON_PATHS, type IconName } from './icons';

	let { name, size = 24 }: { name: string | null | undefined; size?: number } = $props();
	const path = $derived(name && name in ICON_PATHS ? ICON_PATHS[name as IconName] : null);
</script>

{#if path}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d={path} />
	</svg>
{/if}
