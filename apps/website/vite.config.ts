import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { kitcms, kitcmsAdapter } from '@kitcms/core/vite';
import { defineConfig } from 'vite';
import { kitcmsDocs } from './build/docs.ts';

export default defineConfig({
	plugins: [kitcmsDocs(), sveltekit({ preprocess: vitePreprocess(), adapter: kitcmsAdapter() }), kitcms()],
});
