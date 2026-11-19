---
'@kitcms/core': patch
---

Fix sign-in answering 500 in apps installed from npm after Vite discovered `@sveltejs/kit` during `vite dev`: `kitcms()` now also keeps Kit out of the SSR dependency optimizer, so the app and kitcms share one copy and the admin's redirects are recognized.
