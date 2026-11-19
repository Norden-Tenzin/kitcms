<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	let { command }: { command: string } = $props();
</script>

<!-- An inverted slab (dark on the light theme, light on dark): the one loud thing on the page. -->
<div class="install">
	<code><span class="prompt" aria-hidden="true">$</span> <span class="cmd">{command}</span></code>
	<CopyButton text={command} />
</div>

<style>
	.install {
		--copy-bg: var(--accent-alt);
		--copy-fg: var(--accent-alt-ink);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		max-width: 100%;
		width: fit-content;
		padding: 0.5rem 0.5rem 0.5rem 1.25rem;
		border-radius: 1.75rem;
		background: var(--fg);
		color: var(--bg);
	}
	code {
		flex: 1 1 auto;
		min-width: 0;
		padding-block: 0.4rem;
		overflow-x: auto;
		white-space: nowrap;
		scrollbar-width: none;
		font-size: clamp(0.8rem, 0.45rem + 1.4vw, 1.25rem);
		font-weight: 500;
	}
	.prompt {
		color: var(--accent-alt);
		user-select: none;
	}
</style>
