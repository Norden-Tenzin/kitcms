<script lang="ts">
	// Copies `text` to the clipboard and says so. Works only in the browser (needs a secure context).
	let { text, label = 'Copy', describe }: { text: string; label?: string; describe?: string } = $props();
	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard blocked: the text stays selectable next to the button.
		}
	}
</script>

<button type="button" class="copy" onclick={copy} aria-label={copied ? 'Copied' : (describe ?? `${label}: ${text}`)}>
	{copied ? 'Copied' : label}
</button>
<span class="sr-only" role="status" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>

<style>
	.copy {
		min-height: 2.75rem;
		min-width: 2.75rem;
		padding: 0 0.9rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
