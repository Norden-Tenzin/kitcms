import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

const stub = (f: string) => fileURLToPath(new URL(`./test/stubs/${f}`, import.meta.url));

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		// Render on the server (SSR build of the components), with SvelteKit modules stubbed.
		conditions: ['svelte', 'node'],
		alias: { '$app/paths': stub('paths.ts'), '$app/forms': stub('forms.ts'), '$app/navigation': stub('navigation.ts') },
	},
	test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
