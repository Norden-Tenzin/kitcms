<script lang="ts">
	// Outline icon from `icons.ts`. Decorative unless `label` is given.
	import { ICON_PATHS, type UiIconName } from './icons';

	let { name, size = 24, label }: { name: UiIconName | string | null | undefined; size?: number; label?: string } = $props();
	const path = $derived(name && name in ICON_PATHS ? ICON_PATHS[name as UiIconName] : null);
</script>

{#if path}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
		stroke-linecap="round"
		stroke-linejoin="round"
		role={label ? 'img' : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
	>
		<path d={path} />
	</svg>
{/if}
