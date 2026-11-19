<script lang="ts">
	// Copies `text` to the clipboard and says so. Works only in the browser (needs a secure context).
	// Colours come from `--copy-bg` / `--copy-fg` so a parent can theme it.
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
		min-width: 4.5rem;
		padding: 0 1rem;
		border: 0;
		border-radius: 999px;
		background: var(--copy-bg, var(--surface-2));
		color: var(--copy-fg, var(--fg));
		font: inherit;
		font-size: 0.9375rem;
		font-weight: 650;
		cursor: pointer;
		transition: filter 0.15s ease;
	}
	.copy:hover {
		filter: brightness(1.1);
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
