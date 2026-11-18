# Dolkar House: design guide

The demo site is a fictional 12-room guesthouse in Changspa, Leh, Ladakh (3,500 m). This file is for
whoever adds the next designs. Read it, then read `designs.ts` and one finished design.

## The idea

Built from the subject's own inventory: sun-dried mud brick and whitewash, poplar beams and willow-twig
ceilings, a courtyard apricot orchard, a roof with Shanti Stupa one way and Stok Kangri the other,
butter tea, a first day of doing nothing, 3,500 metres. The numbers (3,500 m, 12 rooms, 14 apricot
trees) are used as content, not decoration.

**On this site, the altitude and the orchard become the pace of the page:** few words, large pictures,
long pauses, and the one live fact that is true today (is the house open this month: `seasonStatus()` in
`shell.ts`, shown in the footers and the Ledger hero).

## Three compositions, A, B and C (what each letter means)

Every page type has designs `a`, `b`, `c`. They are different compositions, never colour swaps. The
letters keep one meaning across page types, so the three directions stay coherent when mixed:

| | Idea | Composition habits |
| --- | --- | --- |
| **A** | Editorial, asymmetric ("pictures like prints on a wall") | 12-column grid, pictures at uneven sizes and offsets, text small between them, heading overlapping a picture by a few pixels, staggered vertical offsets, alternating rows |
| **B** | Immersive ("the place carries it") | Full-bleed photographs 80-100svh, the name huge at the bottom edge, one solid card instead of a layout, drag rows, field colours (slate, earth), few words |
| **C** | Structured ("a ledger") | Fixed or sticky photograph beside a scrolling column, tables, grids of equal tiles, datasheets with a sticky panel, surface-tone panels, everything on column lines |

Names so far (`designs.ts` is the source of truth): header Bar / Centred / Overlay, footer Hearth /
Directory / Signboard, home Courtyard / Panorama / Ledger, rooms Salon / Orchard / Compare, room
Threshold / Window / Plan. Part 2 and 3 page types already have names (experiences Trails / Postcards /
Itinerary, journal Field notes / Cover story / Archive, ...). Keep each design's name true to its letter.

## Tokens (`site.css`, scoped under `.site`)

Use tokens only. No hex values in components.

- Colour: `--bg` whitewash lime `#e9e5da`, `--surface` `#ddd8ca`, `--ink` poplar umber `#2a1d17`, `--muted`,
  `--accent` willow green `#3d6433` (buttons, links, one large block), `--earth` mud brick `#7d4f2f`,
  `--slate` `#2b373e`, `--apricot` `#e7a553` (on dark fields only), `--flag` prayer-flag red (status dots,
  errors, sparingly). `site.theme` (hex, validated) can override accent, ground and ink.
- Type: display **Barlow Condensed 700**, uppercase for `h1`, mixed case for `h2`-`h4`; text **Barlow**
  400/500/600 (self-hosted via `@fontsource`). Steps: `--step-small`, `--step-body`, `--step-lead`,
  `--step-h2`, `--step-display`. A page uses five sizes at most.
- Space: `--s-1..--s-7`, `--section` (the gap between sections, 72-152px), `--gutter` (page margin),
  `--max` (82rem). Sections on the page ground pad their top only (`Section.svelte`).
- Shape: one radius `--radius` (4px), one button shape (flat, 48px high, `.btn`, `.btn.ghost`, `.btn.light`).
  No shadows, no outlined boxes, no gradients except the neutral scrim under text on a photograph.

## Components to reuse

- `Img.svelte`: `srcset` through `/cdn-cgi/image` (a no-op in dev and on `*.workers.dev`), width/height,
  lazy unless `eager` (the first picture of a page is eager).
- `Pic.svelte`: a picture in a fixed frame (`ratio` or `fill`); the one place that crops.
- `Section.svelte`: vertical rhythm and field colour (`tone`: bg, surface, accent, earth, slate; `bleed`).
- `Link.svelte` for any href from the CMS, `RichText.svelte` for rich text, `Icon.svelte` for icons
  (`icons.ts`), `Amenities.svelte`, `PageHead.svelte` (list-page title), `reveal.ts` (`use:reveal` scroll
  entrance, visible without script), `format.ts` (INR, dates, room facts), `jsonld.ts`, `Seo.svelte`.
- Header/footer/menu live in `header/` and `footer/`; `Shell.svelte` picks them from the Design tab.
  Header C floats over the first screen: pages that open on a photograph return `overHero` from their load.
- Data: `content.ts` (`loadShell`, `loadPage`, `loadBlockExtras`, `designFor`), `types.ts` (loose
  document types), `media.ts` (`asMedia`: upload fields are ids or documents).

## How to add a design

1. `designs.ts`: add `d: 'Name'` to the page type's `designs` (and a note). The `site` Design tab and the
   per-page selects update themselves (`kitcms.config.ts` builds them from the registry); run
   `pnpm --filter playground db:generate <name>` only if you changed fields (not for new designs).
2. Add the component under `pages/` (or a new `{#if design === 'd'}` branch in the block) and switch on
   `data.design` in the route. The route already resolves it: `designFor('rooms', site, override)`.
3. A block's `design` prop comes from the page's resolved design (`home` for slug `home`, `page` for
   others). Blocks must render every design id; unknown ids fall back to `a`.
4. To add a page type: add it to `PAGE_TYPES`, a `siteDesign('<type>')` line in the config's Design tab
   group, a route, and a loader that calls `designFor`.
5. Screenshot it (below) at 360, 768 and 1280 before you call it done.

## Rules

- Mobile first (320px up). No horizontal page scroll: check `scrollWidth <= innerWidth`.
- Tap targets 44px or more (`min-height: 2.75rem`). Body text 17px or more, never below 14px.
- AA contrast. Check text on `--earth`, `--slate` and `--accent` with `--earth-ink` etc.; muted text only
  on `--bg`/`--surface`. Apricot text only on slate or earth.
- Visible focus (`:focus-visible` is global; do not remove outlines). Semantic landmarks (`header`, `nav`
  with labels, `main#main`, `footer`), one `h1` per page, skip link.
- `prefers-reduced-motion`: motion is opt-in (`reveal` and view transitions are skipped).
- Headlines two lines or fewer at every width; no eyebrow labels, no index numbering, no monospace.
- Photographs are Ladakh pictures, not the (fictional) hotel: never captioned as the hotel's own rooms.
  Credits live in each media document (`credit`) and on `/credits`; files and licences in
  `apps/playground/seed/CREDITS.md`.
- CSS only (no Tailwind), tokens as CSS variables, Svelte 5 runes, imports use `#lib/...` with `.ts`
  extension for TypeScript files.

## Screenshot loop

The playground has a local D1 (`pnpm --filter playground db:migrate && pnpm --filter playground db:seed`).

```sh
pnpm --filter playground dev          # http://localhost:5173
```

Switch a design by saving the site settings in the admin (Site settings, Design tab) or per page with the
page's Design select. Then screenshot every width, for example with Playwright from `e2e/node_modules`
(viewport 360, 768, 1280; scroll the page once so lazy pictures load; `reducedMotion: 'reduce'`) and look at
every one. The design-taste-frontend skill has `scripts/inspect.mjs` (headline lines, fonts, contrast,
overflow) and `references/critique.md` for the look-and-fix rounds. Check
`document.documentElement.scrollWidth <= innerWidth` on every page.
