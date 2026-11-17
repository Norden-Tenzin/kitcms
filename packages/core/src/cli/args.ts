// Pure CLI helpers (no Node APIs): argument parsing, usage text and wrangler config parsing.

export interface ParsedArgs {
	out: string | undefined;
	command: string | undefined;
	positionals: string[];
	config: string | undefined;
	remote: boolean;
	help: boolean;
	unknown: string[];
}

export const COMMANDS = ['generate:schema', 'generate:types', 'migrate:create', 'migrate', 'migrate:status', 'info'] as const;
export type Command = (typeof COMMANDS)[number];

export function isCommand(value: string | undefined): value is Command {
	return COMMANDS.includes(value as Command);
}

export const USAGE = `Usage: kitcms <command> [options]

Commands:
  generate:schema          Write drizzle/schema.ts from the kitcms config
  generate:types [--out <path>]  Write kitcms-types.d.ts (document types for @kitcms/client)
  migrate:create <name>    Generate schema, then create a SQL migration in ./migrations
  migrate [--remote]       Apply migrations with wrangler (local D1 by default)
  migrate:status [--remote]  List migrations with wrangler
  info                     Show config, collections, bindings and migrations_dir check

Options:
  --config <path>          Path to the kitcms config (default: src/kitcms.config.ts or kitcms.config.ts)
  --out <path>             Output file for generate:types (default: kitcms-types.d.ts)
  --remote                 Target the remote D1 database (migrate, migrate:status)
  --help, -h               Show this help
`;

export function parseArgs(argv: string[]): ParsedArgs {
	const out: ParsedArgs = { out: undefined, command: undefined, positionals: [], config: undefined, remote: false, help: false, unknown: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		if (a === '--help' || a === '-h') out.help = true;
		else if (a === '--remote') out.remote = true;
		else if (a === '--config') out.config = argv[++i];
		else if (a === '--out') out.out = argv[++i];
		else if (a.startsWith('--out=')) out.out = a.slice('--out='.length);
		else if (a.startsWith('--config=')) out.config = a.slice('--config='.length);
		else if (a.startsWith('-')) out.unknown.push(a);
		else if (out.command === undefined) out.command = a;
		else out.positionals.push(a);
	}
	return out;
}

/** Candidate config locations relative to the app root, in priority order. */
export const CONFIG_CANDIDATES = ['src/kitcms.config.ts', 'kitcms.config.ts'] as const;

/** Removes `//` and block comments and trailing commas from JSONC, leaving string contents intact. */
export function stripJsonc(src: string): string {
	let out = '';
	let i = 0;
	while (i < src.length) {
		const c = src[i]!;
		if (c === '"') {
			let j = i + 1;
			while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
			out += src.slice(i, j + 1);
			i = j + 1;
		} else if (c === '/' && src[i + 1] === '/') {
			while (i < src.length && src[i] !== '\n') i++;
		} else if (c === '/' && src[i + 1] === '*') {
			const end = src.indexOf('*/', i + 2);
			i = end === -1 ? src.length : end + 2;
		} else {
			out += c;
			i++;
		}
	}
	return out.replace(/,(\s*[}\]])/g, '$1');
}

export type D1Lookup =
	| { status: 'found'; databaseName: string | undefined; migrationsDir: string }
	| { status: 'no-binding' }
	| { status: 'skipped'; reason: string };

/** Finds the D1 entry for `binding` in wrangler config text. `migrations_dir` defaults to `migrations`. */
export function findD1Binding(fileName: string, text: string, binding: string): D1Lookup {
	if (fileName.endsWith('.toml')) return { status: 'skipped', reason: 'wrangler.toml is not parsed; check migrations_dir manually' };
	let json: unknown;
	try {
		json = JSON.parse(stripJsonc(text));
	} catch (e) {
		return { status: 'skipped', reason: `could not parse ${fileName}: ${(e as Error).message}` };
	}
	const dbs = (json as { d1_databases?: unknown }).d1_databases;
	if (Array.isArray(dbs)) {
		for (const d of dbs as Record<string, unknown>[]) {
			if (d && d.binding === binding) {
				return {
					status: 'found',
					databaseName: typeof d.database_name === 'string' ? d.database_name : undefined,
					migrationsDir: typeof d.migrations_dir === 'string' ? d.migrations_dir : 'migrations',
				};
			}
		}
	}
	return { status: 'no-binding' };
}

/** Normalizes `./migrations/` and `migrations` to the same value. */
export function normalizeDir(dir: string): string {
	return dir.replace(/^\.\//, '').replace(/\/+$/, '');
}

/** True when drizzle-kit output says there was nothing to generate. */
export function isNoSchemaChanges(output: string): boolean {
	return /no schema changes/i.test(output);
}
