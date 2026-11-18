# @kitcms/plugin-entitlements

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
