<script lang="ts">
	// The admin's live preview for every block (registered per block in `src/kitcms.admin.ts`). It
	// renders the real site components from the live form values, in the site's `page` design, with
	// the same tokens, so the preview looks like the page. Upload fields hold ids there, so they are
	// resolved to media docs first (`ResolveMedia`). Blocks that list collection data (rooms, FAQs,
	// ...) show their own heading only: that data is not part of the form.
	import '@fontsource/barlow/400.css';
	import '@fontsource/barlow/500.css';
	import '@fontsource/barlow/600.css';
	import '@fontsource/barlow-condensed/700.css';
	import '../site.css';
	import type { BlockPreviewProps } from '@kitcms/ui';
	import { onMount } from 'svelte';
	import { resolveDesign } from '../designs';
	import type { Media } from '../media';
	import type { PageBlock } from '../types';
	import RenderBlocks from './RenderBlocks.svelte';
	import ResolveMedia from './ResolveMedia.svelte';

	let { block }: BlockPreviewProps = $props();

	// The design the site settings pick for plain pages.
	let design = $state('a');
	onMount(async () => {
		try {
			const res = await fetch('/api/globals/site');
			if (res.ok) design = resolveDesign('page', ((await res.json()) as { design?: Record<string, string> }).design);
		} catch {
			// keep the default
		}
	});

	const idOf = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
	const MEDIA_FIELDS = ['image', 'secondImage'] as const;
	const ids = $derived.by(() => {
		const out = MEDIA_FIELDS.map((f) => idOf(block[f])).filter((x): x is string => x !== null);
		if (Array.isArray(block.images)) out.push(...block.images.map(idOf).filter((x): x is string => x !== null));
		return [...new Set(out)];
	});

	let resolved = $state.raw<Record<string, Media | null>>({});
	const onresolve = (id: string, media: Media | null) => {
		if (resolved[id] !== media) resolved = { ...resolved, [id]: media };
	};

	// The block with ids swapped for the resolved media docs.
	const view = $derived.by(() => {
		const out: Record<string, unknown> = { ...block };
		for (const f of MEDIA_FIELDS) {
			const id = idOf(block[f]);
			if (id) out[f] = resolved[id] ?? null;
		}
		if (Array.isArray(block.images)) {
			out.images = block.images.map((v) => resolved[idOf(v) ?? '']).filter((m): m is Media => Boolean(m));
		}
		return out as unknown as PageBlock;
	});
</script>

{#each ids as id (id)}
	<ResolveMedia {id} {onresolve} />
{/each}

<div class="site" style="min-height: 0; display: block;">
	<RenderBlocks blocks={[view]} {design} />
</div>
