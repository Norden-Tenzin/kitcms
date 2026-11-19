---
'@kitcms/core': patch
'@kitcms/ui': patch
---

Read-only deployments: with the Worker var `KITCMS_READ_ONLY=1` (for example a site whose subscription is paused) every content write is refused with a `ReadOnlyError` (403), whoever asks, including system calls and hooks, over the Local API, REST, RPC and uploads. Reading, signing in and signing out keep working, and the admin shows a "paused" notice with no create, save or delete buttons.
