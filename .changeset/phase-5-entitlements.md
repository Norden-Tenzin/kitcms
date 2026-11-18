---
"@kitcms/plugin-entitlements": minor
"@kitcms/core": minor
---

New `@kitcms/plugin-entitlements`: runtime add-on gating from a Worker var (`KITCMS_ENTITLEMENTS`, never stored in D1), with document and upload limits and a read-only "Plan & add-ons" admin panel. Missing or invalid values turn gated features off. `@kitcms/core` now exports its error classes (`ForbiddenError`, `ValidationError`, `isKitcmsError`, ...) for plugins.
