<script lang="ts">
	// A page section: the vertical rhythm (`--section`), an optional field colour and an optional
	// container. Blocks and page types use it so spacing is identical in every design.
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'bg' | 'surface' | 'accent' | 'earth' | 'slate';
		/** `contained` (default) centres a max-width column; `bleed` lets children run edge to edge. */
		bleed?: boolean;
		/** Padding: `section` (default), `none`. */
		pad?: 'section' | 'none' | 'top' | 'bottom';
		id?: string;
		class?: string;
		label?: string;
		children: Snippet;
	}
	let { tone = 'bg', bleed = false, pad = 'section', id, class: className, label, children }: Props = $props();
	// Sections on the page ground only pad their top, so two of them in a row keep one gap, not two.
	const effectivePad = $derived(pad === 'section' && tone === 'bg' ? 'top' : pad);
</script>

<section {id} class={['sec', `pad-${effectivePad}`, className]} data-tone={tone === 'bg' ? undefined : tone} aria-label={label}>
	{#if bleed}{@render children()}{:else}<div class="container">{@render children()}</div>{/if}
</section>

<style>
	.pad-section {
		padding-block: var(--section);
	}
	.pad-top {
		padding-top: var(--section);
	}
	.pad-none {
		padding: 0;
	}
	.pad-bottom {
		padding-bottom: var(--section);
	}
</style>
