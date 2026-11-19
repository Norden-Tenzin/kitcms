#!/usr/bin/env node
// npm smoke test: packs every public package into tarballs, scaffolds each template with the
// packed create-kitcms, points the app at those tarballs (pnpm overrides), then migrates, builds
// and runs the dev server. This exercises what npm users get, not the workspace links.
// Build tooling only (Node). Usage: pnpm smoke:npm
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const TEMPLATES = ['blank', 'website'];
const DEV_READY_TIMEOUT_MS = 90_000;
const STOP_GRACE_MS = 5_000;
const MAX_OUTPUT = 200_000;
const TAIL_LINES = 60;

/** A failed step. `output` is the captured output to show (tail printed). */
class StepFailure extends Error {
	constructor(message, output = '') {
		super(message);
		this.output = output;
	}
}

/** Per-step timings: { template, name, ms, ok }. */
const timings = [];

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Starts a process; output is captured (capped) and `exited` resolves with the exit code. */
function startProcess(cmd, args, { cwd, detached = false }) {
	const child = spawn(cmd, args, {
		cwd,
		detached,
		stdio: ['ignore', 'pipe', 'pipe'],
		env: process.env,
	});
	let output = '';
	const onData = (chunk) => {
		output = (output + chunk.toString()).slice(-MAX_OUTPUT);
	};
	child.stdout.on('data', onData);
	child.stderr.on('data', onData);
	const exited = new Promise((resolve) => {
		let settled = false;
		const done = (code, signal) => {
			if (settled) return;
			settled = true;
			resolve({ code: code ?? 1, signal });
		};
		child.on('error', (err) => {
			output += String(err);
			done(127, null);
		});
		child.on('close', (code, signal) => done(code, signal));
	});
	return { child, exited, output: () => output };
}

async function exec(cmd, args, cwd) {
	const proc = startProcess(cmd, args, { cwd });
	const { code } = await proc.exited;
	return { code, output: proc.output() };
}

/** Runs one named step. Prints PASS/FAIL and records the timing. Throws StepFailure on failure. */
async function step(template, name, fn) {
	const started = performance.now();
	const label = template ? `[${template}] ${name}` : name;
	const record = (ok) =>
		timings.push({ template: template ?? '-', name, ms: performance.now() - started, ok });
	try {
		await fn();
		record(true);
		console.log(`PASS  ${label}  ${secs(performance.now() - started)}`);
	} catch (err) {
		record(false);
		const failure = err instanceof StepFailure ? err : new StepFailure(String(err?.message ?? err));
		console.log(`FAIL  ${label}  ${secs(performance.now() - started)}`);
		console.log(`      ${failure.message}`);
		const tail = failure.output.split('\n').slice(-TAIL_LINES).join('\n').trimEnd();
		if (tail) console.log(tail.replace(/^/gm, '      | '));
		throw failure;
	}
}

/** Runs a command as a step; a non-zero exit fails the step with its output. */
function command(template, name, cmd, args, cwd) {
	return step(template, name, async () => {
		const r = await exec(cmd, args, cwd);
		if (r.code !== 0)
			throw new StepFailure(`$ ${[cmd, ...args].join(' ')} (exit ${r.code})`, r.output);
	});
}

function tarballName(name, version) {
	// npm's pack naming: @scope/name -> scope-name-version.tgz
	return `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;
}

/** Packs every public package in packages/*. Returns name -> absolute tarball path. */
async function packAll(tmp) {
	const dest = path.join(tmp, 'tarballs');
	fs.mkdirSync(dest, { recursive: true });
	const tarballs = new Map();
	for (const dir of fs.readdirSync(PACKAGES_DIR).sort()) {
		const pkgDir = path.join(PACKAGES_DIR, dir);
		const manifest = path.join(pkgDir, 'package.json');
		if (!fs.existsSync(manifest)) continue;
		const pkg = readJson(manifest);
		if (pkg.private) continue;
		await step(null, `pack ${pkg.name}`, async () => {
			if (pkg.scripts?.build) {
				const b = await exec('pnpm', ['run', 'build'], pkgDir);
				if (b.code !== 0) throw new StepFailure(`$ pnpm run build (exit ${b.code})`, b.output);
			}
			const p = await exec('pnpm', ['pack', '--pack-destination', dest], pkgDir);
			if (p.code !== 0) throw new StepFailure(`$ pnpm pack (exit ${p.code})`, p.output);
			const file = path.join(dest, tarballName(pkg.name, pkg.version));
			if (!fs.existsSync(file)) {
				throw new StepFailure(
					`expected ${file}; found: ${fs.readdirSync(dest).join(', ')}`,
					p.output,
				);
			}
			tarballs.set(pkg.name, file);
		});
	}
	return tarballs;
}

/** Scaffolds one template with the packed create-kitcms, then points it at the tarballs. */
async function smokeTemplate(template, tmp, tarballs, createBin) {
	const app = path.join(tmp, `app-${template}`);
	let dev = null;
	try {
		await step(template, 'scaffold', async () => {
			const r = await exec(
				process.execPath,
				[createBin, app, '--template', template, '--yes', '--no-install'],
				tmp,
			);
			if (r.code !== 0) throw new StepFailure(`create-kitcms exited ${r.code}`, r.output);
			if (!fs.existsSync(path.join(app, 'package.json')))
				throw new StepFailure(`no package.json in ${app}`, r.output);
		});

		await step(template, 'point @kitcms/* at tarballs', async () => {
			const file = path.join(app, 'package.json');
			const pkg = readJson(file);
			const overrides = { ...(pkg.pnpm?.overrides ?? {}) };
			for (const [name, tarball] of tarballs) overrides[name] = `file:${tarball}`;
			pkg.pnpm = { ...(pkg.pnpm ?? {}), overrides };
			for (const field of ['dependencies', 'devDependencies']) {
				for (const name of Object.keys(pkg[field] ?? {})) {
					if (tarballs.has(name)) pkg[field][name] = `file:${tarballs.get(name)}`;
				}
			}
			fs.writeFileSync(file, JSON.stringify(pkg, null, '\t') + '\n');
		});

		await command(template, 'pnpm install', 'pnpm', ['install', '--no-frozen-lockfile'], app);

		// The registry also has @kitcms/* versions, so prove the lockfile points at the tarballs.
		await step(template, 'lockfile resolves @kitcms/* from tarballs', async () => {
			const lock = fs.readFileSync(path.join(app, 'pnpm-lock.yaml'), 'utf8');
			const pkg = readJson(path.join(app, 'package.json'));
			const direct = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((n) =>
				n.startsWith('@kitcms/'),
			);
			if (direct.length === 0)
				throw new StepFailure('no direct @kitcms/* dependencies in generated package.json');
			const missing = direct.filter(
				(name) => !tarballs.has(name) || !lock.includes(tarballs.get(name)),
			);
			if (missing.length > 0)
				throw new StepFailure(
					`direct deps not resolved from tarballs in pnpm-lock.yaml: ${missing.join(', ')}`,
				);
		});

		await step(template, '.dev.vars', async () => {
			const example = path.join(app, '.dev.vars.example');
			if (!fs.existsSync(example)) return;
			const secret = randomBytes(30).toString('base64url').slice(0, 40);
			const vars = fs
				.readFileSync(example, 'utf8')
				.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`);
			fs.writeFileSync(path.join(app, '.dev.vars'), vars);
		});

		// The scaffolder skips generation with --no-install, so create the initial migration here.
		await command(template, 'db:generate init', 'pnpm', ['db:generate', 'init'], app);
		await command(template, 'db:migrate (local D1)', 'pnpm', ['db:migrate'], app);
		await command(template, 'build', 'pnpm', ['build'], app);

		const port = await freePort();
		const base = `http://localhost:${port}`;
		dev = startProcess('pnpm', ['dev', '--port', String(port), '--strictPort'], {
			cwd: app,
			detached: true,
		});
		const devOutput = () => dev.output();

		await step(template, `dev server ready (port ${port})`, async () => {
			const deadline = Date.now() + DEV_READY_TIMEOUT_MS;
			let lastError = 'no response';
			while (Date.now() < deadline) {
				const exitedEarly = await Promise.race([dev.exited, sleep(0).then(() => null)]);
				if (exitedEarly) {
					throw new StepFailure(
						`dev server exited (code ${exitedEarly.code}) before serving /`,
						devOutput(),
					);
				}
				try {
					const res = await fetch(`${base}/`, {
						redirect: 'manual',
						signal: AbortSignal.timeout(5_000),
					});
					await res.body?.cancel();
					if (res.status === 200) return;
					lastError = `status ${res.status}`;
				} catch (err) {
					lastError = String(err?.cause?.message ?? err?.message ?? err);
				}
				await sleep(1_000);
			}
			throw new StepFailure(
				`GET / did not return 200 within ${DEV_READY_TIMEOUT_MS / 1000}s (last: ${lastError})`,
				devOutput(),
			);
		});

		await step(template, 'GET /admin is 200 or redirects to /admin/create-first-user', async () => {
			const res = await fetch(`${base}/admin`, {
				redirect: 'manual',
				signal: AbortSignal.timeout(10_000),
			});
			await res.body?.cancel();
			if (res.status === 200) return;
			const location = res.headers.get('location');
			const target = location ? new URL(location, base).pathname : null;
			if (res.status >= 300 && res.status < 400 && target === '/admin/create-first-user') return;
			throw new StepFailure(
				`expected 200 or redirect to /admin/create-first-user, got ${res.status}${location ? ` (location ${location})` : ''}`,
				devOutput(),
			);
		});

		await step(template, 'GET /admin/create-first-user is 200', async () => {
			const res = await fetch(`${base}/admin/create-first-user`, {
				redirect: 'manual',
				signal: AbortSignal.timeout(10_000),
			});
			await res.body?.cancel();
			if (res.status !== 200) throw new StepFailure(`expected 200, got ${res.status}`, devOutput());
		});
	} finally {
		if (dev) await stopGroup(dev);
	}
}

/** Kills the dev server's whole process group (pnpm plus vite), TERM first, then KILL. */
async function stopGroup(proc) {
	const pid = proc.child.pid;
	if (pid === undefined) return;
	signalGroup(pid, 'SIGTERM');
	const exitedInTime = await Promise.race([
		proc.exited.then(() => true),
		sleep(STOP_GRACE_MS).then(() => false),
	]);
	if (!exitedInTime) signalGroup(pid, 'SIGKILL');
}

function signalGroup(pid, signal) {
	try {
		process.kill(-pid, signal);
	} catch (err) {
		if (err.code !== 'ESRCH') throw err;
	}
}

function freePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});
}

function printSummary() {
	console.log('\nSummary');
	for (const template of ['-', ...TEMPLATES]) {
		const rows = timings.filter((t) => t.template === template);
		if (rows.length === 0) continue;
		const total = rows.reduce((sum, t) => sum + t.ms, 0);
		const failed = rows.filter((t) => !t.ok).map((t) => t.name);
		const label = template === '-' ? 'packages' : template;
		const status = failed.length === 0 ? 'PASS' : `FAIL (${failed.join('; ')})`;
		console.log(`  ${label.padEnd(10)} ${status}  total ${secs(total)}`);
		for (const t of rows)
			console.log(`    ${t.ok ? 'ok ' : 'ERR'} ${secs(t.ms).padStart(7)}  ${t.name}`);
	}
}

async function main() {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kitcms-smoke-'));
	let failed = false;
	try {
		let tarballs;
		try {
			tarballs = await packAll(tmp);
		} catch {
			failed = true;
			return;
		}

		const createTarball = tarballs.get('create-kitcms');
		if (!createTarball) {
			console.log('FAIL  create-kitcms tarball missing');
			failed = true;
			return;
		}
		const createDir = path.join(tmp, 'create-kitcms');
		fs.mkdirSync(createDir);
		try {
			await step(null, 'extract create-kitcms', async () => {
				const r = await exec('tar', ['-xzf', createTarball, '-C', createDir], tmp);
				if (r.code !== 0) throw new StepFailure(`tar exited ${r.code}`, r.output);
			});
		} catch {
			failed = true;
			return;
		}
		const createBin = path.join(createDir, 'package', 'bin', 'create.js');

		for (const template of TEMPLATES) {
			try {
				await smokeTemplate(template, tmp, tarballs, createBin);
			} catch {
				failed = true;
			}
		}
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
		printSummary();
		console.log(failed ? '\nnpm smoke test FAILED' : '\nnpm smoke test PASSED');
		process.exitCode = failed ? 1 : 0;
	}
}

await main();
