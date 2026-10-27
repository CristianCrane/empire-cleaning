# Landing site

The public page for prospective Clients at empirecleaningandpro.com: a static site built with Astro and prerendered to HTML, so it loads instantly and search engines can read it (ADR-0005). It replaces the old Next.js site and takes nothing from it.

`pnpm dev` at the repo root starts it on http://localhost:4321. `pnpm --filter @empire-cleaning/landing build` writes the static site to `dist/`, ready for any static host.

- **Look:** the design system's tokens and components (`@empire-cleaning/ui`). React components render to plain HTML at build time.
- **JavaScript:** none, except two interactive islands:
  - the theme toggle, loaded once the browser is idle
  - the Guest Request a Quote form (`@empire-cleaning/quote-request`), loaded when its section scrolls into view

  Until the form loads, and with JavaScript off, its section offers the phone number. The form posts to the API at `PUBLIC_API_URL` (set at build time; by default http://localhost:3000), which allows the landing site's origin (`LANDING_ORIGIN_URL` on the server).

- **Business details** (name, phone, area, page title and description) live in `src/business.ts`, shared by the page, its search data and its tests.
- **Search:** title and description, Open Graph tags for link previews, LocalBusiness structured data, `robots.txt` and a generated sitemap.

## Testing

`pnpm --filter @empire-cleaning/landing test` builds the site, serves the result and tests it with Playwright in a real Chromium, on a phone (everything) and a desktop (the tests tagged `@desktop`, where layout matters; `@smoke` is the quick set). The Request a Quote form talks to the real API and a database of its own (`empire_e2e_landing_test`), so Postgres must be up (`pnpm db:up`). The tests cover:

- every section, in light and dark
- an axe accessibility check in both themes
- the page working with JavaScript switched off
- a Guest asking for a Quote, and the API's field errors showing beside each field
- the theme toggle and the form being the only islands
- no sideways scrolling
- the search data

The browser setup is the same as the design system's (see `packages/ui/README.md`). Install the browser with `pnpm --filter @empire-cleaning/landing test:install-browser`.
