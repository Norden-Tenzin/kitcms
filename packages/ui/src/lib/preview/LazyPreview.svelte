<script lang="ts">
	// Loads a preview component lazily and renders it. `$effect` never runs on the server, so SSR
	// only ever renders the placeholder and no preview code runs there. Load and render errors
	// show inline and never reach the form.
	import { loadComponent, type AnyComponent, type AnyLoader } from './load';

	let {
		loader,
		props,
		label = 'preview',
	}: {
		loader: AnyLoader;
		props: Record<string, unknown>;
		label?: string;
	} = $props();

	let Comp = $state.raw<AnyComponent | undefined>();
	let loadError = $state<string | undefined>();

	$effect(() => {
		const l = loader;
		let live = true;
		Comp = undefined;
		loadError = undefined;
		loadComponent(l).then(
			(c) => {
				if (live) Comp = c;
			},
			(e: unknown) => {
				if (live) loadError = e instanceof Error ? e.message : String(e);
			},
		);
		return () => {
			live = false;
		};
	});
</script>

{#if loadError}
	<div class="err" role="alert">Couldn't load the {label}: {loadError}</div>
{:else if Comp}
	<svelte:boundary>
		<Comp {...props} />
		{#snippet failed(error, reset)}
			<div class="err" role="alert">
				The {label} failed to render: {error instanceof Error ? error.message : String(error)}
				<button type="button" class="retry" onclick={reset}>Retry</button>
			</div>
		{/snippet}
	</svelte:boundary>
{:else}
	<p class="loading" role="status">Loading preview…</p>
{/if}

<style>
	.err {
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--kc-danger);
		border-radius: var(--kc-radius);
		color: var(--kc-danger);
		background: var(--kc-surface);
		font: 13px/1.4 var(--kc-font);
	}
	.retry {
		margin-left: 0.5rem;
		font: inherit;
		cursor: pointer;
	}
	.loading {
		margin: 0;
		padding: 1rem;
		color: var(--kc-muted);
		font: 13px/1.4 var(--kc-font);
	}
</style>
