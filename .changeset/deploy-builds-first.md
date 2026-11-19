---
'create-kitcms': patch
---

The templates' `deploy` script now builds before `wrangler deploy`. Before, `pnpm run deploy` uploaded whatever was in `.svelte-kit/cloudflare` (or failed on a fresh checkout).
