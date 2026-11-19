<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	let { command }: { command: string } = $props();
</script>

<div class="install">
	<code>$ {command}</code>
	<CopyButton text={command} />
</div>

<style>
	.install {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 100%;
		width: fit-content;
		padding: 0.25rem 0.25rem 0.25rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	code {
		min-width: 0;
		overflow-x: auto;
		white-space: nowrap;
		font-size: 0.9375rem;
	}
</style>
