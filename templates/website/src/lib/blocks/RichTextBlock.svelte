<script lang="ts">
	import '../site.css';
	import RichText from '../RichText.svelte';
	import type { BlockOf } from './types';

	let { block }: { block: BlockOf<'richText'> } = $props();
</script>

<section class="section">
	<div class="container"><RichText doc={block.body} /></div>
</section>

<style>
	.section {
		padding-block: 2.5rem;
	}
</style>
