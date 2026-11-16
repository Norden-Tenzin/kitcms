// SPIKE (Phase 0, RPC): the entrypoint other Workers bind to.
import { WorkerEntrypoint, env } from 'cloudflare:workers';
import { render } from 'svelte/server';
import HeroPreview from '#lib/HeroPreview.svelte';
import { sharedState } from '#lib/shared-state.ts';

export class KitcmsRPC extends WorkerEntrypoint {
	async ping() {
		const row = await env.DB.prepare('select 1 as ok').first<{ ok: number }>();
		return { d1: row?.ok, siteRequests: sharedState.requests };
	}

	async renderHero(heading: string) {
		return render(HeroPreview, { props: { heading } }).body;
	}
}
