<script lang="ts">
	// Shown instead of a collection-listing block in the admin live preview, where the collection data
	// is not loaded: the editor sees which block it is and what it will list on the site.
	let { title, text }: { title: string; text: string } = $props();
</script>

<div class="ph">
	<p class="small"><strong>{title}</strong></p>
	<p class="small muted">{text}</p>
</div>

<style>
	.ph {
		padding: var(--s-4) var(--gutter);
		background: var(--surface);
	}
</style>
