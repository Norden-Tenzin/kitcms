// SPIKE (Phase 0, RPC): calls apps/dev's KitcmsRPC entrypoint over a Service Binding.
interface KitcmsRPCSpike {
	ping(): Promise<{ d1: number | undefined; siteRequests: number }>;
	renderHero(heading: string): Promise<string>;
}

interface Env {
	CMS: Service & KitcmsRPCSpike;
	SITE: Fetcher;
}

export default {
	async fetch(_req, env): Promise<Response> {
		const site = await env.SITE.fetch('http://cms/');
		const ping = await env.CMS.ping();
		const hero = await env.CMS.renderHero('Hello from RPC');
		return Response.json({ siteStatus: site.status, ping, hero });
	},
} satisfies ExportedHandler<Env>;
