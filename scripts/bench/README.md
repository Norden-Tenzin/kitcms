# Benchmarks

Outputs go to `scripts/bench/out/` (gitignored). Scripts are Node (>= 22, run with `node` directly).

| Script           | Command             | Measures                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundle-size.ts` | `pnpm bench:bundle` | Builds `apps/playground`, runs `wrangler deploy --dry-run --outdir <tmp> --metafile` (nothing is deployed), and reports the raw and gzip size of the Worker module(s), the top packages and the top modules (esbuild metafile `bytesInOutput`). `--skip-build` reuses the last build. |

Workers Paid allows a 10 MiB (gzip) Worker; the free plan allows 3 MiB. Keep an eye on the gzip number when adding dependencies to runtime packages.
