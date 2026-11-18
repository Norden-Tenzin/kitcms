import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	// Render on the server (SSR build of the components).
	resolve: { conditions: ['svelte', 'node'] },
	test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
