<script lang="ts">
	// Admin preview only: resolves one upload id to a media doc (via `useRelation`) and reports it.
	// Renders nothing. The public site never imports this file, so no admin code reaches it.
	import { useRelation } from '@kitcms/ui';
	import type { Media } from '../media';

	let { id, onresolve }: { id: string; onresolve: (id: string, media: Media | null) => void } =
		$props();

	const rel = useRelation('media', () => id);
	$effect(() => {
		const doc = rel.current;
		onresolve(
			id,
			doc?.url
				? {
						id: doc.id,
						url: doc.url,
						alt: doc.title,
						width: doc.width,
						height: doc.height,
						mimeType: doc.mimeType,
					}
				: null,
		);
	});
</script>
