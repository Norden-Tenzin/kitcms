<script lang="ts">
	// A thin bar at the top that fills as the article is read. Decorative (aria-hidden), no motion
	// beyond the fill itself, which jumps instead of easing under `prefers-reduced-motion`.
	let { target }: { target: string } = $props();
	let ratio = $state(0);

	$effect(() => {
		const el = document.getElementById(target);
		if (!el) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			const r = el.getBoundingClientRect();
			const total = r.height - innerHeight * 0.6;
			ratio = total <= 0 ? 1 : Math.min(1, Math.max(0, -r.top / total));
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		addEventListener('scroll', onScroll, { passive: true });
		addEventListener('resize', onScroll);
		return () => {
			removeEventListener('scroll', onScroll);
			removeEventListener('resize', onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	});
</script>

<div class="bar" aria-hidden="true"><span style:transform={`scaleX(${ratio})`}></span></div>

<style>
	.bar {
		position: fixed;
		inset: 0 0 auto;
		height: 4px;
		z-index: 60;
		pointer-events: none;
	}
	span {
		display: block;
		height: 100%;
		background: var(--apricot);
		transform-origin: left;
		transition: transform 0.12s linear;
	}
	@media (prefers-reduced-motion: reduce) {
		span {
			transition: none;
		}
	}
</style>
