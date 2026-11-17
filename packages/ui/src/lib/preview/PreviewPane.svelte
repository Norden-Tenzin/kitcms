<script lang="ts">
	// The preview pane: header with the desktop/mobile width toggle, and a scrollable body. The
	// body holds `.kitcms-preview`, which resets the admin's inherited typography/colours
	// (`all: initial`) so site styles that preview components bring along aren't affected by the
	// admin theme. The preview always renders on a light canvas (system `Canvas`/`CanvasText`).
	// Preview components must treat `doc`/`block` as READ-ONLY: they are the live form state.
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
	let width = $state<'desktop' | 'mobile'>('desktop');
</script>

<aside class="pane" aria-label="Live preview" data-testid="preview-pane">
	<div class="bar">
		<strong>Preview</strong>
		<span class="spacer"></span>
		<div class="seg" role="group" aria-label="Preview width">
			<button
				type="button"
				class="kc-btn kc-btn--ghost"
				aria-pressed={width === 'desktop'}
				data-testid="preview-desktop"
				onclick={() => (width = 'desktop')}>Desktop</button
			>
			<button
				type="button"
				class="kc-btn kc-btn--ghost"
				aria-pressed={width === 'mobile'}
				data-testid="preview-mobile"
				onclick={() => (width = 'mobile')}>Mobile</button
			>
		</div>
	</div>
	<div class="scroll">
		<div class="frame" data-width={width}>
			<div class="kitcms-preview">{@render children()}</div>
		</div>
	</div>
</aside>

<style>
	.pane {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		border: 1px solid var(--kc-border);
		border-radius: var(--kc-radius);
		background: var(--kc-surface);
		overflow: hidden;
		max-height: calc(100vh - 2rem);
		min-height: 12rem;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.75rem;
		border-bottom: 1px solid var(--kc-border);
	}
	.spacer {
		flex: 1;
	}
	.seg {
		display: inline-flex;
		gap: 0.25rem;
	}
	.seg button[aria-pressed='true'] {
		background: var(--kc-accent);
		color: var(--kc-accent-text);
	}
	.scroll {
		overflow: auto;
		padding: 0.75rem;
		background: var(--kc-bg);
	}
	.frame {
		width: 100%;
		margin: 0 auto;
		border: 1px solid var(--kc-border);
		border-radius: var(--kc-radius);
		overflow: hidden;
		background: var(--kc-surface);
	}
	.frame[data-width='mobile'] {
		width: 390px;
		max-width: 100%;
	}
	/* Resets inherited admin styles for the previewed site content. */
	.kitcms-preview {
		all: initial;
		display: block;
		background: Canvas;
		color: CanvasText;
		font-family: system-ui, sans-serif;
		line-height: 1.5;
		min-height: 6rem;
		container-type: inline-size;
	}
</style>
