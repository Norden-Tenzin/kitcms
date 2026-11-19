---
'@kitcms/core': patch
---

Fix apps installed from npm: `@kitcms/core/vite` now ships compiled JavaScript (Node can't strip types under `node_modules`, so `svelte-kit sync` failed on a fresh `create-kitcms` app), and `kitcms()` keeps `@kitcms/*` out of Vite's dependency pre-bundling and SSR externals so `vite dev` compiles them as source.
