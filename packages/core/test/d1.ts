// Test-only harness (Node allowed): an in-memory Miniflare D1 with the kitcms schema applied.
// `createTestDb(config)` is the whole API; tests build an adapter with `createD1Adapter(config, d1)`.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { SanitizedConfig } from '../src/config/sanitized';
import { getTables } from '../src/schema/drizzle';

export interface TestDb {
	d1: D1Database;
	dispose(): Promise<void>;
}

/** The CREATE statements for a config, as drizzle-kit would generate the first migration. */
export async function createSchemaStatements(config: SanitizedConfig): Promise<string[]> {
	const kit = await import('drizzle-kit/api');
	const empty = await kit.generateSQLiteDrizzleJson({});
	const next = await kit.generateSQLiteDrizzleJson(getTables(config));
	return kit.generateSQLiteMigration(empty, next);
}

export async function createTestDb(config: SanitizedConfig): Promise<TestDb> {
	// Miniflare 5 takes the new config shape; the V4 (flat) options are converted.
	const mf = new Miniflare(
		convertV4MiniflareOptions({
			modules: true,
			script: 'export default { fetch() { return new Response() } }',
			d1Databases: ['DB'],
		}),
	);
	try {
		const d1 = (await mf.getD1Database('DB')) as unknown as D1Database;
		for (const stmt of await createSchemaStatements(config)) {
			// drizzle-kit may emit several `;`-separated statements in one string.
			for (const part of stmt.split('--> statement-breakpoint')) {
				if (part.trim()) await d1.prepare(part.trim()).run();
			}
		}
		return { d1, dispose: () => mf.dispose() };
	} catch (err) {
		await mf.dispose();
		throw err;
	}
}
