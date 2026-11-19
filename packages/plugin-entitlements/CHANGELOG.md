# @kitcms/plugin-entitlements

## 0.1.2

### Patch Changes

- 73cdd61: Settings that differ per deployment can be functions resolved per request, from the Worker env and the site's own content: `email.from`, `email.replyTo` and `admin.title` in the config, the enquiry forms' `notify` and `turnstile.siteKey`, and the entitlements panel's `manageUrl`. Plugin endpoints and panels get a `runtime` context (`{ env, cms }`, where `cms` reads as the system and cannot write) to resolve their own options. `resolveValue`, `Resolvable` and `RuntimeContext` are exported from `@kitcms/core`.
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
- Updated dependencies [73cdd61]
  - @kitcms/core@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [8dc2324]
  - @kitcms/core@0.1.1

## 0.1.0

### Minor Changes

- 6a989aa: New `@kitcms/plugin-entitlements`: runtime add-on gating from a Worker var (`KITCMS_ENTITLEMENTS`, never stored in D1), with document and upload limits and a read-only "Plan & add-ons" admin panel. Missing or invalid values turn gated features off. `@kitcms/core` now exports its error classes (`ForbiddenError`, `ValidationError`, `isKitcmsError`, ...) for plugins.

### Patch Changes

- Updated dependencies [db7d444]
- Updated dependencies [fbda014]
- Updated dependencies [ca0ac7a]
- Updated dependencies [6a989aa]
- Updated dependencies [7fd9d05]
  - @kitcms/core@0.1.0
