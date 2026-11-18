<script lang="ts">
	import type { Snippet } from 'svelte';

	// For hrefs that come from the CMS (editors type them), which can't be typed routes.
	let {
		href,
		class: className,
		children,
		...rest
	}: { href: string; class?: string; children: Snippet; [key: string]: unknown } = $props();
	const external = $derived(/^https?:\/\//i.test(href));
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {href} class={className} rel={external ? 'noopener' : undefined} {...rest}>{@render children()}</a>
