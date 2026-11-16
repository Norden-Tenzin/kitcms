// See https://svelte.dev/docs/kit/types#app.d.ts
// SvelteKit 3 + adapter-cloudflare 8 no longer pass `platform`; bindings come from
// `import { env } from 'cloudflare:workers'`, typed via Cloudflare.Env.
declare global {
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
			BUCKET: R2Bucket;
			/** Better Auth signing secret: `.dev.vars` locally, `wrangler secret put` when deployed. */
			BETTER_AUTH_SECRET: string;
		}
	}
}

export {};
