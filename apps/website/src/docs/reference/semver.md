---
title: Semver and upgrade policy
description: What counts as public API, what may change in a release and how versions are numbered.
order: 4
---

This page defines what kitcms promises about its versions, so you know what an upgrade can and cannot break.

## One version for everything

All `@kitcms/*` packages and `create-kitcms` release together as one group with one version. `@kitcms/core` and `@kitcms/ui` therefore always match, and the internal contract between them can change in any release.

## What is public

These are covered by semver. Changing them in a breaking way needs a new major version (or a new minor before 1.0).

| Entry | Surface |
|---|---|
| `@kitcms/core` | `defineConfig`, `collection`, `global`, `block`, `fields`, `defineSeed`, every exported config, field, hook, access and where type, `KitcmsPlugin`, `Register`, `LocalAPI`, `Cms`, and the Local API methods and options. |
| `@kitcms/core/sveltekit` | `kitcms({ config, auth })` returning `{ handle, config }`, its option types, and the `App.Locals` additions (`cms`, `user`, `session`). |
| `@kitcms/core/sveltekit/admin`, `/api` | The names the generated route files re-export: `load`, `actions`, `GET`, `POST`, `PATCH`, `DELETE`. |
| `@kitcms/core/rpc` | `createKitcmsRPC`, the method names, arguments and options of `KitcmsRPC`, and the wire error format `kitcms:<CODE>:<status>: <message>`. |
| `@kitcms/core/vite` | `kitcms(options)` and `kitcmsAdapter(options)`. |
| `@kitcms/core/richtext` | `toHTML`, `toPlainText`, `escapeHTML`, `safeHref`, `isRichTextDoc`. |
| `@kitcms/client` | `kitcms(binding, options)`, `KitcmsClient`, `KitcmsClientError`, `isKitcmsClientError`, its option types and the generated-types contract (`KitcmsTypes`). |
| `@kitcms/ui` | `Admin`, `defineAdmin`, `useRelation`, `MediaPicker`, `FileUpload`, `FieldShell`, `getFormContext`, `FieldProps`. |
| Plugins | `seo`, `getMeta`, `SeoHead`, `SerpPreview`, and the plugin options. |
| CLI | The `kitcms` commands and flags, the `create-kitcms` flags and the shape of generated files (route files, `kitcms.rpc.ts`, `drizzle/schema.ts`, `kitcms-types.d.ts`). |
| Database mapping | How the config maps to tables. A change that makes an unchanged config produce a migration is breaking. |

## What is internal

These may change in any release, even a patch:

- `getKitcms`, `KitcmsInternals` and the other exports marked `@internal`.
- `@kitcms/core/client`, the contract between core and the admin.
- The sanitized config shapes (`SanitizedConfig`, `ClientConfig`).
- The edge-cache key format.
- The internals of the reference and version tables, beyond what migrations need.

Do not import these in your app.

## Version numbers

**Before 1.0** (`0.x`):

- A **minor** release may break. Its changeset says what and gives upgrade steps.
- A **patch** release never breaks.

**From 1.0:**

- A breaking change is a **major** release.
- Deprecations last at least one minor before removal.

## RPC compatibility across deploys

A consumer Worker's `@kitcms/client` and the CMS Worker's `@kitcms/core` deploy separately, so they can be on different versions. Within a major version:

- The server accepts every option and method of earlier minors.
- The client never sends options that an older server of the same major would reject, unless the caller passes them.
- The wire error format never changes.

## Security fixes

A patch release may tighten behaviour to fix a security problem, by failing closed. It is documented as such in the changelog.

## Migrations

A release that needs a schema change says so in its changeset and ships a migration path: generate it with `kitcms migrate:create`, review the SQL and apply it with `kitcms migrate --remote`. See [Upgrading](../deploy/upgrading.md).
