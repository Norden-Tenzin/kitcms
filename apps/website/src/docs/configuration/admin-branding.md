---
title: Admin branding
description: Set the admin title, logo and accent colours.
order: 9
---

This page shows how to put your own name, logo and colours on the admin.

```ts title="src/kitcms.config.ts"
import { defineConfig } from '@kitcms/core';

export default defineConfig({
	admin: {
		title: 'Acme CMS',
		branding: {
			logo: '/logo.svg',
			colors: { accent: '#0b7285', accentText: '#ffffff' },
		},
	},
	collections: [],
});
```

## Options

| Option | What it does |
|---|---|
| `admin.title` | Shown in the admin header and browser title, and named in invite and password reset emails. Default `'kitcms'`. A constant or a function. |
| `admin.branding.logo` | An `https:` URL, a `/`-relative path or a `data:image/` URL. Shown in the header next to the title and above the sign-in and first-user forms. The title is always shown as text too. |
| `admin.branding.colors.accent` | Buttons, links and focus rings. |
| `admin.branding.colors.accentText` | Text on `accent` backgrounds. |

Colours are CSS colours: hex, `rgb()`, `hsl()`, `oklch()`, `oklab()` or a named colour. Set `accent` and `accentText` together or not at all. The config fails to load if you set only one, so the text on the accent stays readable.

kitcms sets the colours as the `--kc-accent` and `--kc-accent-text` CSS variables on the admin root. Hover and focus states follow the accent. Without them, the default theme applies, including dark mode.

## A title from the site's content

`admin.title` can be a function, so one build can show each site's own name. It receives the Worker `env` and a read-only `cms`:

```ts title="src/kitcms.config.ts"
export default defineConfig({
	admin: {
		title: async ({ cms }) => String((await cms.findGlobal('site'))?.siteName ?? 'My site'),
	},
	collections: [],
});
```

The function runs on each admin page. If it throws or returns an empty value, the admin shows `kitcms`, so a missing global never locks anyone out. See [Per-request values](./per-request-values.md).

Everything else is validated when the config loads. A bad logo URL or colour is a config error, not a broken admin.
