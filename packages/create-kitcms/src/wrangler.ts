/** Extracts the D1 database id from `wrangler d1 create` output (JSON or TOML snippet). */
export function parseDatabaseId(output: string): string | undefined {
	const keyed = /["']?database_id["']?\s*[:=]\s*["']([^"']+)["']/.exec(output);
	if (keyed?.[1]) return keyed[1];
	return /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.exec(output)?.[0];
}
