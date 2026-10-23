# Landing site

The public page for prospective Clients at empirecleaningandpro.com: a static site built with Astro and prerendered to HTML, so it loads instantly and search engines can read it (ADR-0005). It replaces the old Next.js site and takes nothing from it.

`pnpm dev` at the repo root starts it on http://localhost:4321. `pnpm --filter @empire-cleaning/landing build` writes the static site to `dist/`, ready for any static host.

- **Look:** the design system's tokens and components (`@empire-cleaning/ui`). React components render to plain HTML at build time.
- **JavaScript:** none, except interactive islands. Today the only island is the theme toggle, loaded once the browser is idle. The Quote Request form joins it in #3.
- **Business details** (name, phone, area, page title and description) live in `src/business.ts`, shared by the page, its search data and its tests.
- **Search:** title and description, Open Graph tags for link previews, LocalBusiness structured data, `robots.txt` and a generated sitemap.

## Testing

`pnpm --filter @empire-cleaning/landing test` builds the site, serves the result and tests it with Playwright in a real Chromium, on a phone and a desktop. The tests cover:

- every section, in light and dark
- an axe accessibility check in both themes
- the page working with JavaScript switched off
- the theme toggle being the only island
- no sideways scrolling
- the search data

The browser setup is the same as the design system's (see `packages/ui/README.md`). Install the browser with `pnpm --filter @empire-cleaning/landing test:install-browser`.
