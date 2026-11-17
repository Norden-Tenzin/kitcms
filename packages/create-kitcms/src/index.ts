import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline/promises';
import { TEMPLATES, USAGE, parseArgs } from './args.js';
import {
	copyTemplate,
	isNonEmptyDir,
	linkDependencies,
	setDatabaseId,
	templatesDir,
	toAppName,
	writeDevVars,
} from './scaffold.js';
import { parseDatabaseId } from './wrangler.js';

export const VERSION = '0.0.0';
export { parseArgs, USAGE, type Args } from './args.js';
export * from './scaffold.js';
export { parseDatabaseId } from './wrangler.js';

export interface ExecResult {
	code: number;
	stdout: string;
	stderr: string;
}

export interface Deps {
	cwd: string;
	log: (message: string) => void;
	/** Runs a command; `inherit` streams its output to the terminal. */
	exec: (cmd: string, args: string[], opts: { cwd: string; inherit?: boolean }) => Promise<ExecResult>;
	/** Asks a question; resolves with the answer or the default. */
	ask: (question: string, fallback: string) => Promise<string>;
	interactive: boolean;
	/** Overrides the templates directory (tests). */
	templatesDir?: string;
}

export function nodeExec(cmd: string, args: string[], opts: { cwd: string; inherit?: boolean }): Promise<ExecResult> {
	return new Promise((resolve) => {
		const child = spawn(cmd, args, { cwd: opts.cwd, stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		child.stdout?.on('data', (d: Buffer) => (stdout += d));
		child.stderr?.on('data', (d: Buffer) => (stderr += d));
		child.on('error', (e) => resolve({ code: 127, stdout, stderr: stderr + String(e) }));
		child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
	});
}

function nodeDeps(): Deps {
	const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
	return {
		cwd: process.cwd(),
		log: (m) => console.log(m),
		exec: nodeExec,
		interactive,
		ask: async (question, fallback) => {
			const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
			try {
				const answer = (await rl.question(`${question} (${fallback}) `)).trim();
				return answer || fallback;
			} finally {
				rl.close();
			}
		},
	};
}

export async function main(argv: string[]): Promise<number> {
	try {
		return await run(argv, nodeDeps());
	} catch (e) {
		console.error(`create-kitcms: ${e instanceof Error ? e.message : String(e)}`);
		return 1;
	}
}

/** Runs the scaffolder and returns the process exit code. */
export async function run(argv: string[], deps: Deps): Promise<number> {
	const { log } = deps;
	const args = parseArgs(argv);
	if (args.help) return log(USAGE), 0;
	if (args.unknown.length) {
		log(`create-kitcms: unknown option "${args.unknown[0]}"\n\n${USAGE}`);
		return 1;
	}
	const ask = async (q: string, d: string) => (args.yes || !deps.interactive ? d : deps.ask(q, d));

	if (args.template === 'website') {
		log('The "website" template is coming soon. Use --template blank for now.');
		return 1;
	}
	if (!(TEMPLATES as readonly string[]).includes(args.template)) {
		log(`create-kitcms: unknown template "${args.template}" (available: ${TEMPLATES.join(', ')})`);
		return 1;
	}

	const dirInput = args.dir ?? (await ask('Project name / directory?', 'kitcms-app'));
	const target = path.resolve(deps.cwd, dirInput);
	if (isNonEmptyDir(target)) {
		log(`create-kitcms: target directory "${target}" is not empty. Pick another name or empty it first.`);
		return 1;
	}
	const appName = toAppName(path.basename(target));
	const names = { db: appName, bucket: appName };
	const root = deps.templatesDir ?? templatesDir();

	copyTemplate(path.join(root, args.template), target, {
		__APP_NAME__: appName,
		__DB_NAME__: names.db,
		__DB_ID__: `<run: wrangler d1 create ${names.db}>`,
		__BUCKET_NAME__: names.bucket,
	});
	writeDevVars(target);
	if (args.link) linkDependencies(target, args.link);
	log(`Created ${appName} in ${target}`);

	let installed = false;
	if (args.install) {
		log('\nInstalling dependencies with pnpm...');
		const r = await deps.exec('pnpm', ['install'], { cwd: target, inherit: true });
		installed = r.code === 0;
		if (!installed) log('pnpm install failed. Fix the error above, then run it yourself.');
	}

	// D1 + R2 on the user's Cloudflare account (only when logged in to wrangler).
	let resourcesCreated = false;
	if (installed) {
		const wrangler = (a: string[]) => deps.exec('pnpm', ['exec', 'wrangler', ...a], { cwd: target });
		let want = args.createResources;
		let loggedIn: boolean | undefined;
		if (!want && !args.yes && deps.interactive) {
			loggedIn = (await wrangler(['whoami'])).code === 0;
			if (loggedIn) want = /^y/i.test(await ask('Create the D1 database and R2 bucket now?', 'y'));
		}
		if (want) {
			loggedIn ??= (await wrangler(['whoami'])).code === 0;
			if (!loggedIn) log('wrangler is not logged in (run "pnpm exec wrangler login"); skipping resource creation.');
			else {
				const d1 = await wrangler(['d1', 'create', names.db]);
				const id = parseDatabaseId(d1.stdout + d1.stderr);
				const r2 = await wrangler(['r2', 'bucket', 'create', names.bucket]);
				if (d1.code === 0 && id) setDatabaseId(target, id);
				else log(`Could not create the D1 database:\n${d1.stdout}${d1.stderr}`);
				if (r2.code !== 0) log(`Could not create the R2 bucket:\n${r2.stdout}${r2.stderr}`);
				resourcesCreated = d1.code === 0 && Boolean(id) && r2.code === 0;
			}
		}
	}

	let migrated = false;
	if (installed) {
		log('\nGenerating and applying the initial migration (local D1)...');
		const gen = await deps.exec('pnpm', ['exec', 'kitcms', 'migrate:create', 'init'], { cwd: target, inherit: true });
		const mig = gen.code === 0 ? await deps.exec('pnpm', ['exec', 'kitcms', 'migrate'], { cwd: target, inherit: true }) : gen;
		migrated = mig.code === 0;
		if (!migrated) log('The local migration failed. Fix the error above, then run "pnpm db:generate init && pnpm db:migrate".');
	}

	const rel = path.relative(deps.cwd, target) || '.';
	const steps = [`cd ${rel}`];
	if (!installed) steps.push('pnpm install');
	if (!migrated) steps.push('pnpm db:generate init', 'pnpm db:migrate');
	steps.push('pnpm dev', '(open http://localhost:5173/admin to create the first admin user)');
	log(`\nNext steps:\n  ${steps.join('\n  ')}`);
	if (!resourcesCreated) {
		log(
			`\nBefore deploying, create the Cloudflare resources and put the D1 database_id into wrangler.jsonc:\n  pnpm exec wrangler d1 create ${names.db}\n  pnpm exec wrangler r2 bucket create ${names.bucket}`,
		);
	}
	log(
		`\nDeploy (requires Workers Paid: password hashing exceeds the Free plan CPU limit):\n  pnpm db:migrate --remote\n  pnpm exec wrangler secret put BETTER_AUTH_SECRET\n  pnpm run deploy`,
	);
	return 0;
}
