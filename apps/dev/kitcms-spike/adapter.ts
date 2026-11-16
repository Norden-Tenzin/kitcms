// SPIKE (Phase 0, RPC): wraps adapter-cloudflare. After it writes the Worker to wrangler `main`,
// we move that file aside and write a facade that also re-exports the RPC entrypoint class.
import fs from 'node:fs';
import path from 'node:path';
import cloudflare from '@sveltejs/adapter-cloudflare';
import type { Adapter } from '@sveltejs/kit';
import { unstable_readConfig } from 'wrangler';
import { RPC_ENTRY_NAME } from './vite-plugin.ts';

export function kitcmsAdapter(options: Parameters<typeof cloudflare>[0] = {}): Adapter {
	const inner = cloudflare(options);
	return {
		...inner,
		name: 'kitcms-adapter-cloudflare',
		async adapt(builder) {
			await inner.adapt(builder);

			const config = unstable_readConfig({ config: options.config });
			if (!config.main) throw new Error('kitcms: wrangler `main` is required');
			const worker = config.main;
			const dir = path.dirname(worker);
			const moved = path.join(dir, '_sveltekit_worker.js');
			fs.renameSync(worker, moved);

			const rpc = path.join(builder.getServerDirectory(), `${RPC_ENTRY_NAME}.js`);
			if (!fs.existsSync(rpc)) throw new Error(`kitcms: RPC entry not built (${rpc})`);
			const rel = (p: string) => {
				const r = path.relative(dir, p).split(path.sep).join('/');
				return r.startsWith('.') ? r : `./${r}`;
			};
			fs.writeFileSync(
				worker,
				`export { default } from ${JSON.stringify(rel(moved))};\n` +
					`export * from ${JSON.stringify(rel(rpc))};\n`,
			);

			// The worker dir may double as the assets dir: never upload the moved file as a static asset.
			const ignore = path.join(dir, '.assetsignore');
			if (fs.existsSync(ignore)) fs.appendFileSync(ignore, '\n_sveltekit_worker.js\n');
		},
	};
}
