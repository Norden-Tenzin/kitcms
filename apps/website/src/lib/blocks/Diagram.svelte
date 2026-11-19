<script lang="ts">
	// Two simple deployment diagrams, drawn with currentColor and the site's CSS variables.
	let { mode }: { mode: 'fullApp' | 'headless' } = $props();
</script>

{#if mode === 'fullApp'}
	<svg viewBox="0 0 360 200" role="img" aria-labelledby="d-full" class="diagram">
		<title id="d-full">A browser talks to one Worker that holds the site, the admin and the API. The Worker reads D1 and R2.</title>
		<g fill="none" stroke="currentColor" stroke-width="1.5">
			<rect x="10" y="80" width="70" height="40" rx="6" />
			<rect x="120" y="30" width="130" height="140" rx="8" />
			<rect x="135" y="48" width="100" height="26" rx="4" stroke-dasharray="3 3" />
			<rect x="135" y="82" width="100" height="26" rx="4" stroke-dasharray="3 3" />
			<rect x="135" y="116" width="100" height="26" rx="4" stroke-dasharray="3 3" />
			<rect x="290" y="45" width="60" height="36" rx="6" />
			<rect x="290" y="120" width="60" height="36" rx="6" />
			<path d="M80 100h40M250 70h40M250 135h40" />
		</g>
		<g fill="currentColor" font-size="11" text-anchor="middle" font-family="var(--font-sans)">
			<text x="45" y="104">Browser</text>
			<text x="185" y="22">One Worker</text>
			<text x="185" y="65">Site</text>
			<text x="185" y="99">Admin</text>
			<text x="185" y="133">API</text>
			<text x="320" y="67">D1</text>
			<text x="320" y="142">R2</text>
		</g>
	</svg>
{:else}
	<svg viewBox="0 0 360 200" role="img" aria-labelledby="d-head" class="diagram">
		<title id="d-head">Another Worker calls the kitcms Worker over a Service Binding RPC. The kitcms Worker reads D1 and R2.</title>
		<g fill="none" stroke="currentColor" stroke-width="1.5">
			<rect x="10" y="70" width="80" height="60" rx="8" />
			<rect x="150" y="50" width="100" height="100" rx="8" />
			<rect x="295" y="45" width="55" height="36" rx="6" />
			<rect x="295" y="120" width="55" height="36" rx="6" />
			<path d="M90 100h60" stroke-dasharray="4 3" />
			<path d="M250 70h45M250 135h45" />
		</g>
		<g fill="currentColor" font-size="11" text-anchor="middle" font-family="var(--font-sans)">
			<text x="50" y="97">Your</text>
			<text x="50" y="111">Worker</text>
			<text x="200" y="97">kitcms</text>
			<text x="200" y="111">Worker</text>
			<text x="120" y="90">Service</text>
			<text x="120" y="122">Binding RPC</text>
			<text x="322" y="67">D1</text>
			<text x="322" y="142">R2</text>
		</g>
	</svg>
{/if}

<style>
	.diagram {
		display: block;
		width: 100%;
		height: auto;
		color: var(--fg);
	}
</style>
