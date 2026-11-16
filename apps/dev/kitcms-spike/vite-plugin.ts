// SPIKE (Phase 0, RPC): adds the kitcms RPC module as an extra entry of SvelteKit's SSR build,
// so it is compiled by Vite (aliases, .svelte imports) and shares chunks with the app.
import path from 'node:path';
import type { Plugin } from 'vite';

export const RPC_ENTRY_NAME = 'kitcms-rpc';

export function kitcmsSpike(opts: { rpcEntry: string }): Plugin {
	return {
		name: 'kitcms:rpc-entry',
		enforce: 'post',
		configEnvironment(name, config) {
			if (name !== 'ssr' || !config.build?.rolldownOptions?.input) return;
			const input = config.build.rolldownOptions.input;
			if (typeof input !== 'object' || Array.isArray(input)) {
				throw new Error('kitcms: unexpected SvelteKit SSR input shape');
			}
			input[RPC_ENTRY_NAME] = path.resolve(opts.rpcEntry);
		},
	};
}
