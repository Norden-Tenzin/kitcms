---
'@kitcms/core': patch
---

Server-to-server setup for hosting platforms: `POST /api/system/seed/:name` runs a seed from `config.system.seeds` with a JSON `input`, and `POST /api/system/users` creates a user (an admin by default) and emails them a set-password invite. Both are idempotent and need `Authorization: Bearer <token>` matching the Worker secret `KITCMS_SYSTEM_TOKEN` (at least 32 characters); without it they return 404.
