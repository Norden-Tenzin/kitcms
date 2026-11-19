---
'@kitcms/core': minor
'@kitcms/plugin-enquiries': minor
'@kitcms/plugin-entitlements': minor
---

Settings that differ per deployment can be functions resolved per request, from the Worker env and the site's own content: `email.from`, `email.replyTo` and `admin.title` in the config, the enquiry forms' `notify` and `turnstile.siteKey`, and the entitlements panel's `manageUrl`. Plugin endpoints and panels get a `runtime` context (`{ env, cms }`, where `cms` reads as the system and cannot write) to resolve their own options. `resolveValue`, `Resolvable` and `RuntimeContext` are exported from `@kitcms/core`.
