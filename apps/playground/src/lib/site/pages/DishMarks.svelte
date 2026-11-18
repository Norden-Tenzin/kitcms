<script lang="ts">
	// Ladakhi and vegetarian markers for a dish: a small shape and the word (never colour alone).
	let { ladakhi, vegetarian }: { ladakhi?: boolean | null; vegetarian?: boolean | null } = $props();
</script>

{#if ladakhi || vegetarian}
	<span class="marks small">
		{#if ladakhi}<span><i class="lad" aria-hidden="true"></i>Ladakhi</span>{/if}
		{#if vegetarian}<span><i class="veg" aria-hidden="true"></i>Vegetarian</span>{/if}
	</span>
{/if}

<style>
	.marks {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0 var(--s-3);
		color: inherit;
		opacity: 0.9;
	}
	.marks span {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
	}
	i {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		background: currentColor;
	}
	.veg {
		border-radius: 50%;
	}
	.lad {
		transform: rotate(45deg) scale(0.9);
	}
</style>
