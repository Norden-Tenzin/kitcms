---
title: Custom domains
description: Serve your kitcms app on your own domain with a custom_domain route.
order: 2
---

This page shows how to attach your own domain to the Worker and why you want to.

A Worker is reachable on `<name>.<account>.workers.dev` right after deploy. For production, use your own domain. Two kitcms features only work on one:

- The [edge cache](./edge-cache.md), because the Workers Cache API does nothing on `workers.dev`.
- [Image transformations](../media/images.md), because they need a zone with Transformations enabled.

## Add the route

The domain's DNS must be on Cloudflare. Add a `routes` entry to `wrangler.jsonc`, then deploy:

```jsonc title="wrangler.jsonc"
{
	"routes": [{ "pattern": "example.com", "custom_domain": true }]
}
```

With `custom_domain: true`, Cloudflare creates the DNS record and certificate for you. Use one entry per hostname, for example `www.example.com` as well.

## Order of operations

1. Deploy to `workers.dev` first.
2. [Create your admin account](./index.md#6-create-the-first-admin) on that URL.
3. Add the `routes` entry and deploy again.

That way the setup screen is never open to anyone on your public domain.

## Set the public origin

If sign-in behaves oddly behind your domain, set `BETTER_AUTH_URL` to its origin, for example `https://example.com`. It also forces secure cookies. See [Auth and users](../auth/index.md).

## Media on its own domain

To serve uploads from a separate domain, attach a custom domain to the R2 bucket and set `media.publicUrl` in the config. See [Media](../media/index.md).
