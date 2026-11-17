// See https://svelte.dev/docs/kit/types#app.d.ts
// Bindings come from `import { env } from 'cloudflare:workers'`, typed via Cloudflare.Env.
import type config from './kitcms.config';

declare module '@kitcms/core' {
	interface Register {
		config: typeof config;
	}
}

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
