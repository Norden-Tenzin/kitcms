/// <reference types="node" />
// Node only (build tooling). CLI dispatch; `bin/kitcms.js` calls `run`. Never import this from runtime code.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { USAGE, isCommand, parseArgs } from './args';
import { generateSchema, generateTypesFile, info, migrate, migrateCreate, migrateStatus, type Ctx } from './commands';
import { CliError } from './load-config';

function readVersion(): string {
	try {
		const require = createRequire(import.meta.url);
		return (JSON.parse(fs.readFileSync(require.resolve('../../package.json'), 'utf8')) as { version: string }).version;
	} catch {
		return 'unknown';
	}
}

/** Runs the CLI and returns the process exit code. */
export async function run(argv: string[], cwd: string, log: (m: string) => void = console.log): Promise<number> {
	const args = parseArgs(argv);
	if (args.help && !args.command) return log(USAGE), 0;
	if (!isCommand(args.command) || args.unknown.length) {
		const bad = args.unknown[0] ?? args.command;
		if (bad) console.error(`kitcms: unknown ${args.unknown.length ? 'option' : 'command'} "${bad}"\n`);
		console.error(USAGE);
		return args.help && !bad ? 0 : 1;
	}
	if (args.help) return log(USAGE), 0;
	const ctx: Ctx = { root: cwd, configOption: args.config, remote: args.remote, log };
	try {
		switch (args.command) {
			case 'generate:schema':
				await generateSchema(ctx);
				break;
			case 'generate:types':
				await generateTypesFile(ctx, args.out);
				break;
			case 'migrate:create':
				await migrateCreate(ctx, args.positionals[0]);
				break;
			case 'migrate':
				await migrate(ctx);
				break;
			case 'migrate:status':
				await migrateStatus(ctx);
				break;
			case 'info':
				await info(ctx, readVersion());
				break;
		}
		return 0;
	} catch (e) {
		console.error(`kitcms: ${e instanceof CliError || e instanceof Error ? e.message : String(e)}`);
		return 1;
	}
}

