---
'create-kitcms': patch
---

Validate the project name length (3-58 characters) before scaffolding. It doubles as the Worker, D1 and R2 bucket name, and R2 rejects names shorter than 3 characters, which broke `pnpm install` for short names like `t2`. Prompted names are asked again; names passed as an argument exit with an error.
