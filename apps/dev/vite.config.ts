import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { kitcms, kitcmsAdapter } from '@kitcms/core/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({ preprocess: vitePreprocess(), adapter: kitcmsAdapter() }),
		// Dev RPC (Decision 16) is opt-in: `pnpm dev:rpc` (see packages/core/src/vite/index.ts).
		kitcms({ devRpc: process.env.KITCMS_DEV_RPC === '1' }),
	],
});
