import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { AUTH_FILE, CMS_PORT, CMS_URL, CONSUMER_PORT, CONSUMER_URL, STATE } from './constants';

// The CMS Worker and the consumer find each other (Service Binding) through a registry dir that is
// private to this run, so a developer's own `wrangler dev` / `vite dev` is never involved.
const registry = { WRANGLER_REGISTRY_PATH: path.join(STATE, 'registry'), CLOUDFLARE_DEV_REGISTRY_PATH: path.join(STATE, 'registry') };

export default defineConfig({
	testDir: './tests',
	outputDir: './test-results',
	// One shared database: tests run in file order, one at a time.
	fullyParallel: false,
	workers: 1,
	retries: 0,
	forbidOnly: Boolean(process.env.CI),
	reporter: [['list']],
	timeout: 30_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: CMS_URL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		actionTimeout: 10_000,
		navigationTimeout: 20_000,
	},
	projects: [
		// Creates the first user, then checks logout/login; saves a signed-in session for the rest.
		{ name: 'auth', testMatch: /auth\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
		{
			name: 'admin',
			testMatch: /admin-.*\.spec\.ts/,
			dependencies: ['auth'],
			use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
		},
		{ name: 'rpc', testMatch: /rpc\.spec\.ts/, dependencies: ['admin'], use: { ...devices['Desktop Chrome'] } },
	],
	webServer: [
		{
			// Fresh state + build + migrations, then the built app under `wrangler dev` (workerd).
			command: [
				'node scripts/prepare.mjs',
				`pnpm --filter dev exec wrangler dev --port ${CMS_PORT} --inspector-port 9331 --persist-to "${STATE}" --var BETTER_AUTH_SECRET:e2e-secret-0123456789abcdef0123456789abcdef`,
			].join(' && '),
			cwd: '.',
			url: `${CMS_URL}/admin`,
			timeout: 300_000,
			reuseExistingServer: false,
			env: registry,
			stdout: 'pipe',
		},
		{
			// The headless consumer, bound to the CMS over Service Binding RPC (`E2E=1` enables its
			// `/e2e/call` proxy for tests/rpc.spec.ts).
			command: `pnpm --filter dev-consumer exec wrangler dev --port ${CONSUMER_PORT} --inspector-port 9332 --var E2E:1`,
			cwd: '.',
			url: `${CONSUMER_URL}/error`,
			timeout: 120_000,
			reuseExistingServer: false,
			env: registry,
		},
	],
});
