<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	// For hrefs that come from the CMS (editors type them), which can't be typed routes.
	let { href, class: className, children, ...rest }: HTMLAnchorAttributes = $props();
	const external = $derived(/^https?:\/\//i.test(href ?? ''));
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {href} class={className} rel={external ? 'noopener' : undefined} {...rest}>{@render children?.()}</a>
