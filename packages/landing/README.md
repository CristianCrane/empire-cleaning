# Landing site

Astro, prerendered to static HTML (ADR-0005). `pnpm dev` at the repo root starts it on http://localhost:4321; `pnpm --filter @empire-cleaning/landing build` writes `dist/`.

## Set at build time

- `PUBLIC_API_URL`: the API the Quote form posts to, http://localhost:3000 unless set; the server allows the site's origin by its `LANDING_ORIGIN_URL`.
- `PUBLIC_SENTRY_DSN`: without it, no Sentry.
- `PUBLIC_APP_MODE`: Sentry's environment; `test` adds the feedback button.
- `PUBLIC_CF_ANALYTICS_TOKEN`: Cloudflare's beacon, production only, set on production's landing service (`render-production.yaml`).
- `SENTRY_AUTH_TOKEN` and `SENTRY_ORG`: source maps go to Sentry's `landing` project.

## Where content lives

- Reviews: `src/reviews.ts`, real Google reviews, word for word.
- The business's details and words: `src/business.ts`; the Services: `src/services.ts`.
- Every page's address in each language: `src/routes.ts` (`pathOf`).
- A content module's Spanish twin sits beside it (`queens.es.ts`), its facts taken from the English by `twin()`.
- The components' words: `src/words.ts`.
- The policies: `src/legal`; a change to what one says gets a new `effective` date.

The typecheck is `astro check`, on TypeScript 6 (its own `typescript` in `package.json`) until `@astrojs/check` takes 7: move it then.

## Prototypes

On a `prototype-*` branch: `src/prototypes/<screen>.ts` and `.astro`, written as `src/prototype.ts` says, drawn at `/prototype/<screen>/`. The bar for stepping through one is in `pnpm dev` alone.

## Testing

```sh
pnpm --filter @empire-cleaning/landing test
```

It builds the site, serves it and tests it in a real Chromium: phone (every test) and desktop (`@desktop`), `@smoke` the quick set. The Quote form talks to the real API and a database of its own, so Postgres must be up (`pnpm db:up`).

Tests run in parallel against one API and database that nothing resets: a test that sends the form asks as its own Client, with `newEmail()` from `tests/harness.ts`, and reads its emails with `emailsTo`. 2 workers (ADR-0032); `--workers` sets it.

Browser setup: the design system's README; `pnpm --filter @empire-cleaning/landing test:install-browser`.
