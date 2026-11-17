# Benchmarks

Outputs go to `scripts/bench/out/` (gitignored). All scripts are Node (>= 22, run with `node` directly).

| Script                   | Command             | Measures                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse.ts`               | `pnpm bench:parse`  | `JSON.parse`, `JSON.stringify` and Drizzle's JSON-column mapping (`mapFromDriverValue`) in microseconds per op, for 10 and 20 block payloads. Runs in Node (same V8 as workerd), 20k iterations after warm-up.                                                                                                                                                 |
| `bundle-size.ts`         | `pnpm bench:bundle` | Builds `apps/dev`, runs `wrangler deploy --dry-run --outdir <tmp> --metafile`, reports raw/gzip size of the Worker module(s), top packages and top modules (esbuild metafile `bytesInOutput`). `--skip-build` reuses the last build.                                                                                                                           |
| `cold-start.ts`          | `pnpm bench:cold`   | Deploys `apps/dev` as the **separate Worker `kitcms-bench`** (refuses any other name), captures wrangler's "Worker Startup Time", then times 11 requests each to `/` and `/spike/bench?blocks=15&iterations=1` (first = cold). Flags: `--no-deploy`, `--base-url <url>` (or `BENCH_BASE_URL`), `--name`. The workers.dev URL is parsed from wrangler's output. |
| route `GET /spike/bench` | see below           | D1 read timings for a page with N blocks: page row by slug, media `IN` query, the two in one `DB.batch`, sequential total. Raw `env.DB` vs Drizzle.                                                                                                                                                                                                            |

## The bench route

`/spike/bench?blocks=10|15|20&iterations=20&reseed=1` (apps/dev)

- Disabled (404) unless the Worker var `KITCMS_BENCH` is `"1"`, because it seeds data. `cold-start.ts` deploys with `--var KITCMS_BENCH:1`; locally put `KITCMS_BENCH=1` in `apps/dev/.dev.vars`.
- Seeds `bench-{blocks}` in the hidden `bench` collection (blocks from `apps/dev/src/lib/bench/`) plus its media, idempotently (`reseed=1` recreates).
- Measures through the REAL Local API (Phase 1 pipeline) against raw D1, as min/median/p95 ms:
  - raw D1 row (`env.DB.prepare`, 1 round trip)
  - `findByID` depth 0 (1 round trip) and depth 1 (2 round trips: row, then all relations in one batch)
  - `find` with `limit: 10` (rows + count in one batch)
- Local (`pnpm --filter dev dev`) numbers measure miniflare/SQLite (~4-5 ms per call). Deployed numbers measure real D1 round trips.

## Timer caveat (read this before quoting numbers)

Inside a deployed Worker, `performance.now()` and `Date.now()` only advance when I/O completes (Spectre mitigation). CPU-only work such as `JSON.parse` or Drizzle row mapping therefore reads as **0 ms** in the route's `parse` series when deployed. So:

- D1 / round-trip numbers: from the deployed route (valid, I/O-bound).
- JSON.parse / stringify / row-mapping cost: from `bench:parse` in Node only.
- CPU time of a whole request in a deployed Worker: `wrangler tail <worker> --format json`, field `cpuTime` (ms). This works (e.g. `/spike/bench?iterations=10` reported `cpuTime` 131 ms, `/` reported 15 ms) but includes all the per-call D1 client overhead, not just parsing.
- Cold start: wrangler's "Worker Startup Time" is measured at deploy validation. The `cold-start.ts` request times are client wall time including network RTT from your machine.
