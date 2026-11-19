---
title: Access control and hooks
description: How every operation passes through access rules, hooks, validation and D1, whichever way it arrives.
order: 1
---

This page explains the one pipeline that every kitcms operation runs through and where access rules and hooks fit in it.

## One pipeline

The Local API, Service Binding RPC, the REST API and the admin all call the same operations. Each operation runs these steps, in this order:

1. **Access.** Can this caller do this operation?
2. **Hooks (before).** Your code can change the data.
3. **Validate.** Required fields, limits and your `validate` functions.
4. **D1.** The write or read happens, in one `batch()` call where there are several statements.
5. **Hooks (after).** Your code can react or reshape the result.

Nothing else reads or writes content. Even the admin goes through the Local API, with `source: 'admin'`. That is why an access rule you write once protects every entry point.

D1 has no interactive transactions, so a write plus its reference updates run as one `batch()`, which D1 applies atomically.

## Who the caller is

| Entry point | Caller |
|---|---|
| `locals.cms` in a route | The signed-in user, or anonymous. Public routes never resolve the session, so they are always anonymous. |
| Admin | The signed-in admin user. |
| REST | The session user (cookie) or anonymous. |
| RPC | Anonymous, or `{ as: 'system' }` for trusted Workers. |

The caller is `req.user`: `null` when anonymous, otherwise `{ id, email, name, role, collection }`. The request also carries `req.source` (`'local'`, `'admin'`, `'rpc'` or `'rest'`), `req.context` and `req.cms`.

## `overrideAccess`

`overrideAccess: true` skips collection and field access rules. Hooks and validation still run.

```ts
// A scheduled job that reads everything
const all = await cms.find('posts', { overrideAccess: true, limit: 100 });
```

Use it for trusted server code only: seeds, scheduled jobs, system work. Never derive it from request input. kitcms never reads `overrideAccess` from a client: REST ignores it, and RPC accepts only `{ as: 'system' }`, which sets it for you.

## The rest of this section

- [Access rules](./rules.md): collection and field rules, defaults, and how a rule that returns a filter merges with the caller's query.
- [Hooks](./hooks.md): every hook, its order and what it can return.
