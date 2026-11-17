import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { kitcms, kitcmsAdapter } from '@kitcms/core/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: kitcmsAdapter() }), kitcms()],
});
