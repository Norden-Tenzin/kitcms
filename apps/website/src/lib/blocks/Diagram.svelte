<script lang="ts">
	// Two deployment diagrams in inline SVG, drawn with the site's tokens so they stay crisp and
	// readable in both themes: filled boxes (no hairlines), the accent for the kitcms Worker.
	let { mode }: { mode: 'fullApp' | 'headless' } = $props();
</script>

{#if mode === 'fullApp'}
	<svg viewBox="0 0 360 220" role="img" aria-labelledby="d-full" class="diagram">
		<title id="d-full">A browser talks to one Worker that holds the site, the admin and the API. The Worker reads D1 and R2.</title>
		<g class="link">
			<path d="M84 110h38" />
			<path d="M246 78h38M246 142h38" />
		</g>
		<rect class="box" x="6" y="88" width="78" height="44" rx="10" />
		<rect class="worker" x="122" y="14" width="124" height="192" rx="14" />
		<rect class="inner" x="136" y="44" width="96" height="40" rx="8" />
		<rect class="inner" x="136" y="90" width="96" height="40" rx="8" />
		<rect class="inner" x="136" y="136" width="96" height="40" rx="8" />
		<rect class="box" x="284" y="56" width="70" height="44" rx="10" />
		<rect class="box" x="284" y="120" width="70" height="44" rx="10" />
		<g class="label" text-anchor="middle">
			<text x="45" y="115">Browser</text>
			<text class="on-worker" x="184" y="33">One Worker</text>
			<text class="on-inner" x="184" y="69">Site</text>
			<text class="on-inner" x="184" y="115">Admin</text>
			<text class="on-inner" x="184" y="161">API</text>
			<text x="319" y="83">D1</text>
			<text x="319" y="147">R2</text>
		</g>
	</svg>
{:else}
	<svg viewBox="0 0 360 220" role="img" aria-labelledby="d-head" class="diagram">
		<title id="d-head">Another Worker calls the kitcms Worker over a Service Binding RPC. The kitcms Worker reads D1 and R2.</title>
		<g class="link">
			<path d="M82 110h78" stroke-dasharray="5 4" />
			<path d="M256 78h28M256 142h28" />
		</g>
		<rect class="box" x="6" y="74" width="76" height="72" rx="10" />
		<rect class="worker" x="160" y="54" width="96" height="112" rx="14" />
		<rect class="box" x="284" y="56" width="70" height="44" rx="10" />
		<rect class="box" x="284" y="120" width="70" height="44" rx="10" />
		<g class="label" text-anchor="middle">
			<text x="44" y="106">Your</text>
			<text x="44" y="124">Worker</text>
			<text class="on-worker" x="208" y="106">kitcms</text>
			<text class="on-worker" x="208" y="124">Worker</text>
			<text class="small" x="121" y="98">Service</text>
			<text class="small" x="121" y="130">Binding RPC</text>
			<text x="319" y="83">D1</text>
			<text x="319" y="147">R2</text>
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
	.box {
		fill: var(--surface-2);
	}
	.worker {
		fill: var(--accent);
	}
	.inner {
		fill: var(--accent-ink);
		fill-opacity: 0.16;
	}
	.link {
		fill: none;
		stroke: var(--muted);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.label {
		fill: var(--fg);
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 650;
	}
	.label .on-worker,
	.label .on-inner {
		fill: var(--accent-ink);
	}
	.label .small {
		font-size: 11.5px;
		font-weight: 600;
		fill: var(--muted);
	}
</style>
