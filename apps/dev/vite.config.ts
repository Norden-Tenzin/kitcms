import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { kitcmsAdapter } from './kitcms-spike/adapter.ts';
import { kitcmsSpike } from './kitcms-spike/vite-plugin.ts';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: kitcmsAdapter()
		}),
		kitcmsSpike({ rpcEntry: 'src/kitcms.rpc.ts' })
	]
});
