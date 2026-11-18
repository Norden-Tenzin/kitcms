# Halden Studio site: design notes

A calm, typographic studio site. Light only. One accent, real photographs, no gradients except a
neutral scrim under text that sits on a photograph. Everything is tokens in `site.css`, scoped under
`.site` so nothing leaks into the admin (the admin block previews wrap their output in `.site` too).

## Tokens (`site.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f6f5f1` | page ground |
| `--ink` | `#161716` | text, `.inverse` fields |
| `--accent` | `#2f5d50` | buttons, links, `.accent-field` |
| `--accent-ink` | `#fff` | text on the accent (recomputed for a theme accent) |
| `--surface`, `--surface-2` | ink 5% / 9% on bg | tint steps instead of rules |
| `--muted` | ink 66% on bg | secondary text |
| `--gutter` | 16px at phone, up to 32px | page margin |
| `--section` | 64 to 152px | gap between sections |
| `--s-1..7` | 4px to ~144px | spacing steps |
| `--header-h` | 72 / 80px | header height (also the floating header's clearance) |

`site.theme` (accent, background, text) is applied as inline variables on `.site` by `themeStyle`
(`shell.ts`) after `isHex` validation; surface, muted and line colours are derived from them in CSS.

Type: Instrument Serif (display, headings) and Hanken Grotesk Variable (text), both via @fontsource.
Five sizes: `--step-small` 15px, `--step-0` 17px, `--step-lead` 19 to 24px, `--step-h3` 26 to 36px,
`--step-h2` 38 to 72px, `--step-h1` 48 to 128px. Headings tighten tracking (-0.015 to -0.025em).

Helpers: `.container`, `.section`, `.surface`, `.inverse` (ink field), `.accent-field`, `.lead`, `.small`,
`.muted`, `.btn` (`.ghost`, `.light`), `.link`, `.more`, `.prose` (CMS rich text), `.reveal` (scroll entrance,
use with the `reveal` action from `reveal.ts`; content is visible without script).

## Designs

Every page type has designs a/b/c (`designs.ts`). The site picks the design from `site.design.<type>`; a
document can override it. `designFor(type, site, override)` (`content.ts`) resolves it; in dev
`devPick(url)` (`devDesign.ts`) lets `?design=a|b|c` override it for screenshots (and `?header=`, `?footer=`).

- **Header**: A Bar (sticky, wordmark left, links and button right). B Split (tall, scrolls away, wordmark
  centred, links either side, tinted ground). C Floating (a solid inset bar over the content; page content is
  padded below it by `.site[data-header='c'] main`, so nothing sits under it. Never add a sticky strip that
  uses `top: 0` under header C). The menu is a native `<dialog>`; without script the Menu link jumps to the
  footer navigation (`#footer-nav`).
- **Footer**: A Simple (name, links, contact). B Columns (four labelled columns on a tint). C Statement (ink
  field, the email as the largest link on it).
- **Home** (hero first): A Editorial (big headline + portrait photo; services as large rows; work in two offset
  columns; one large quote). B Showcase (full-bleed hero photo; service tiles with photographs; one large
  picture per project; accent-field stats). C Studio index (typographic hero with a wide strip; services and
  work as text indexes; ink stats; featured post).
- **Page** (CMS pages): A Editorial (title very large beside the cover). B Immersive (cover is the first screen,
  title on it; accent field without a cover). C Structured (title on a tint with a contents list).

Every block takes a `design` prop (`'a' | 'b' | 'c'`) and has a different composition per letter, not just colour.

### List and detail pages (`pages/`)

Components in `pages/`, routes under `(site)/`. Each takes the resolved `design` letter. Detail pages use the same
letter as their list where there is no separate type (a service uses `services`).

- **Services** (`/services`, `/services/[slug]`): A List (huge title, ruled rows with number, summary, price).
  B Cards (tinted field, photo cards in two offset columns). C Steps (each service beside its process as numbered
  steps). Detail: A text and "What you get" columns then process rows; B photo opening with the title on a scrim,
  process as four tiles; C process first as a large numbered sequence, ink price card beside the text. Related work
  and a "Start a project" link to `/contact?service=<slug>`.
- **Work** (`/work`, `?service=<slug>` filter as plain links): A Grid (three portrait columns). B Large rows
  (wide picture, alternating sides, title and summary). C Index (ruled table with a thumbnail). **Project**: A Case
  study (cover wide, facts then story and quote, gallery). B Gallery first (mosaic of the pictures, then words).
  C Fact sheet (tinted fact table beside cover and text, gallery strip). The Lightbox opens from every picture.
- **Blog** (`/blog`, `?tag=`, `?page=` as plain links, 9 per page): A Journal (newest large, dated entries with a
  thumbnail). B Cards (three-column grid). C Index (ruled dates and titles). **Post**: A Essay (narrow centred
  column), B Feature (photo opening, author rail), C Article (tinted head, rail with author). All end with related posts.
- **Contact**: both enquiry forms on every design, in `#brief` and `#message` (`EnquiryFields.svelte`). A Form first
  (brief first, details and the short form in a column). B Split (ink panel with details, forms beside it).
  C Directory (four contact tiles, then the forms side by side). Without script the form posts and the server redirects
  to `/contact?form=<form>&enquiry=sent`; `form` says which of the two shows the thanks message.
- JSON-LD: `Service`, `CreativeWork` (projects), `BlogPosting` (posts). Lists with a filter or past page 1 are `noindex`.
- Photo openings (service B, post B) use white text on a neutral scrim, start below the floating header, and fall
  back to an accent field without a cover.

## Using it (for the next pages)

- Content: `content.ts` is the only data layer. `loadShell(cms)` (layout), `loadPage(cms, slug)` and
  `loadBlockExtras(cms, blocks)` (collection data for listing blocks). For list pages call `cms.find(...)` in
  `+page.server.ts` and pass docs into components. Types: `types.ts` (`Page`, `Service`, `Project`, `Post`, ...,
  upload and relationship fields are `unknown`: narrow with `asMedia`, `asMediaList`, `asDoc` from `media.ts`).
- Layout data (`data.site`, `data.legal`) comes from `(site)/+layout.server.ts`; use `await parent()` in a load
  to read `site` for `designFor`.
- Shell: `buildShell(site, legal)` -> `Shell` (`shell.ts`); `Shell.svelte` wraps pages.
- Components: `Img` (responsive, `eager` for the first screen), `Pic` (fixed-ratio frame), `Link` (CMS hrefs),
  `Icon` (names in `icons.ts`), `RichText`, `Seo` (title, description, image, `noIndex`, `jsonLd`),
  `Lightbox` (`bind:index`), `blocks/RenderBlocks` (a page's `sections`), `blocks/SectionHead`.
- SEO: read the plugin's `meta` group with `metaOf(doc)` (`meta.ts`).
- Offers: `loadBlockExtras` turns a `ForbiddenError` from the `offers` add-on into `null`; the Offers block
  renders nothing for `null`. Use the same `forbiddenAsNull` approach for any other gated collection.
- Rules for new designs: a floating header must never overlap the first section of any page type; test every
  new page at 390 and 1440 with header A, B and C (`?design=` and `?header=` in dev). Tap targets are at least
  44px; images carry width and height (or a ratio frame) and are lazy except on the first screen; no
  horizontal scroll at 390.
