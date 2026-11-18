---
"@kitcms/plugin-seo": minor
---

`seo()` gains `redirects` (an editor-managed `redirects` collection applied before the site renders, with loop and unsafe-target checks), `sitemap` (`/sitemap.xml` from published documents, skipping `noIndex`) and `robots` (`/robots.txt`). Turning on `redirects` adds a table: run `kitcms migrate:create`.
