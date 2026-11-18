<script lang="ts">
	import { toHTML } from '@kitcms/core/richtext';
	import type { RichTextDoc } from '@kitcms/core';

	let { doc, class: className }: { doc: unknown; class?: string } = $props();
	const html = $derived(toHTML(doc as RichTextDoc | null | undefined));
</script>

{#if html}
	<!-- Safe: toHTML escapes every text and attribute value and only emits allow-listed link schemes. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class={['prose', className]}>{@html html}</div>
{/if}
