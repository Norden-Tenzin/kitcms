<script lang="ts">
	// A picture viewer on the native <dialog> (modal: focus is trapped, Escape closes, the page behind is
	// inert). Arrow keys, Home/End and the buttons move between pictures; a horizontal swipe does too.
	// Closing returns focus to the thumbnail that opened it. Set `index` to open at a picture, to `null` to close.
	import Icon from './Icon.svelte';
	import Img from './Img.svelte';
	import type { Media } from './media';

	interface Props {
		images: Media[];
		index: number | null;
		/** Names the dialog for assistive tech, e.g. the gallery heading. */
		label?: string;
	}
	let { images, index = $bindable(null), label = 'Photographs' }: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let opener: HTMLElement | null = null;
	const current = $derived(index === null ? null : (images[index] ?? null));
	const count = $derived(images.length);

	$effect(() => {
		if (!dialog) return;
		if (index !== null && !dialog.open) {
			opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			dialog.showModal();
		} else if (index === null && dialog.open) {
			dialog.close();
		}
	});

	// Escape and `dialog.close()` both land here.
	function onclose() {
		index = null;
		opener?.focus();
		opener = null;
	}
	const go = (delta: number) => {
		if (index === null || !count) return;
		index = (index + delta + count) % count;
	};
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
		else if (e.key === 'Home') index = 0;
		else if (e.key === 'End') index = count - 1;
		else return;
		e.preventDefault();
	}
	// A click on the dark area outside the picture closes.
	function onclick(e: MouseEvent) {
		if (e.target === dialog || (e.target as HTMLElement).classList.contains('stage')) dialog?.close();
	}
	// Swipe: a mostly horizontal drag of 50px or more.
	let startX = 0;
	let startY = 0;
	function down(e: PointerEvent) {
		startX = e.clientX;
		startY = e.clientY;
	}
	function up(e: PointerEvent) {
		const dx = e.clientX - startX;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - startY) * 1.5) go(dx < 0 ? 1 : -1);
	}
</script>

<dialog bind:this={dialog} aria-label={label} {onclose} {onkeydown} {onclick}>
	<div class="bar">
		<p class="small" aria-live="polite">{index === null ? '' : `${index + 1} of ${count}`}</p>
		<button type="button" class="ic" onclick={() => dialog?.close()} aria-label="Close"><Icon name="close" /></button>
	</div>
	<div class="stage" role="presentation" onpointerdown={down} onpointerup={up}>
		{#if count > 1}
			<button type="button" class="ic nav prev" onclick={() => go(-1)} aria-label="Previous photograph"><Icon name="arrow" /></button>
		{/if}
		{#if current}
			{#key current.id}
				<Img media={current} eager widths={[800, 1400, 1600]} sizes="100vw" class="view" />
			{/key}
		{/if}
		{#if count > 1}
			<button type="button" class="ic nav next" onclick={() => go(1)} aria-label="Next photograph"><Icon name="arrow" /></button>
		{/if}
	</div>
	{#if current}
		<p class="cap">
			{#if current.caption || current.alt}<span>{current.caption || current.alt}</span>{/if}
			{#if current.credit}<span class="small">Photo: {current.credit}</span>{/if}
		</p>
	{/if}
</dialog>

<style>
	dialog {
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: var(--ink);
		color: var(--bg);
		overflow: hidden;
	}
	dialog[open] {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
	}
	dialog::backdrop {
		background: var(--ink);
	}
	dialog :focus-visible {
		outline-color: var(--bg);
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 1rem 0 var(--gutter);
	}
	.stage {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 0;
		padding-inline: 0.5rem;
		touch-action: pan-y;
	}
	.stage :global(.view) {
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: calc(100dvh - 12rem);
		object-fit: contain;
	}
	.ic {
		display: inline-grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.ic:hover {
		background: color-mix(in srgb, currentColor 16%, transparent);
	}
	.nav {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		z-index: 1;
		background: color-mix(in srgb, var(--ink) 70%, transparent);
	}
	.prev {
		left: 0.5rem;
	}
	.prev :global(svg) {
		rotate: 180deg;
	}
	.next {
		right: 0.5rem;
	}
	.cap {
		display: grid;
		gap: 0.25rem;
		padding: 1rem var(--gutter) 1.5rem;
		max-width: 70ch;
		margin-inline: auto;
		text-align: center;
	}
	.cap .small {
		opacity: 0.8;
	}
	@media (min-width: 56rem) {
		.stage {
			padding-inline: 5rem;
		}
	}
</style>
