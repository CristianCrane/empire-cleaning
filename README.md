# dev mode

1. start the db (docker):

```shell
pnpm run db:up
```

2. concurrently start all the apps in dev mode (watch + hot reloading):

```shell
pnpm run dev
```

3. browse the design system catalogue (Storybook, http://localhost:6006); the web app runs on http://localhost:5173 and the landing site on http://localhost:4321:

```shell
pnpm --filter @empire-cleaning/ui storybook
```

4. run the tests (the browser tests need Chromium; see packages/ui/README.md). `pnpm db:up` also starts a separate Postgres for tests, in memory and with disk syncing off, on port 5433:

```shell
pnpm test        # quick: design system, server and a handful of end-to-end journeys
pnpm test:full   # everything; run it before opening the PR
```

Both run one package at a time and report every failure. See each package's README for what it covers.

5. clean up when finished:

```shell
pnpm run db:down
```

# CI

Every pull request to `main`, and every push to `main`, runs `.github/workflows/ci.yml`. Each part is its own check, and they run in parallel; a newer push to the same pull request cancels the run still going. To run the same locally (with `pnpm db:up` for the Postgres the tests use):

| Check                | Locally                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Checks               | `pnpm check`, `pnpm lint`, `pnpm lint:unused`, `pnpm format:check`, `pnpm check:packages` (below) |
| Server tests         | `pnpm --filter @empire-cleaning/server test`                                                      |
| Design-system tests  | `pnpm --filter @empire-cleaning/ui test`                                                          |
| Web end-to-end tests | `pnpm --filter @empire-cleaning/web test`                                                         |
| Landing site tests   | `pnpm --filter @empire-cleaning/landing test`                                                     |

What the Checks job is for:

| Step                                                        | Catches                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck (`pnpm check`)                                    | Type errors, in every package. On top of `strict`: unused imports, variables and parameters (one kept for its place is named `_req`), a case falling through, and an index read that may find nothing (`noUncheckedIndexedAccess`: write `days[0]!` when it can't). `exactOptionalPropertyTypes` stays off: nearly all it found was `undefined` passed to React Aria's optional props. |
| Lint (`pnpm lint`)                                          | Code that is wrong, with type information: oxlint's correctness rules, promises nobody awaits, a switch with no `default` missing a case, and the rules of React hooks (use `useEffectEvent` for what an effect reads but shouldn't re-run for). It's oxlint (`.oxlintrc.json`, which says why each rule is on or off) because typescript-eslint can't read TypeScript 7.              |
| Unused files, exports and dependencies (`pnpm lint:unused`) | What nothing uses across the workspace: a file nothing imports, an export no other file reads, a dependency nothing loads (knip, `knip.jsonc`).                                                                                                                                                                                                                                        |
| Formatting (`pnpm format:check`)                            | Code Prettier would lay out differently; `pnpm format` fixes it.                                                                                                                                                                                                                                                                                                                       |
| Package consistency (`pnpm check:packages`)                 | Packages disagreeing on a dependency's version, or misdeclaring each other (manypkg).                                                                                                                                                                                                                                                                                                  |
| Scrubbing tests                                             | What may reach Sentry and the logs, and the browsers' Sentry setup.                                                                                                                                                                                                                                                                                                                    |

CI starts `postgres_test` from `docker-compose.yml`, needs no secrets (email, payments and the clock are faked in tests), and builds `@empire-cleaning/models` first, since the other packages read its types from `dist`. When an end-to-end check fails, its Playwright report and the failed tests' traces are kept as an artifact on the run; open a trace with `pnpm --filter @empire-cleaning/web exec playwright show-trace <trace.zip>`.

# Test site

The test site (ADR-0020) is described in `render.yaml`: the server, its Postgres and the two static sites on Render, at `test.empirecleaningandpro.com` (landing) and `app.test.empirecleaningandpro.com` (web app, with `/api` rewritten to the server). A push to `main` deploys it once CI passes, and migrations run before each new server starts. Production is never deployed automatically.

`APP_MODE=test` makes it say so: a banner on every page, `[TEST]` on every email subject, and no search indexing. Its email goes only to `EMAIL_ALLOWED` addresses; the rest goes to the Office inbox with the intended recipient in the subject. To put fresh seed data on it, run the **Reset test data** Action (`.github/workflows/reset-test-data.yml`).

To set it up from nothing (Stripe sandbox and webhook, Google sign-in client, Resend key, the Render Blueprint, DNS on Vercel, the reset Action's `TEST_DB_URL` secret), run `scripts/setup-test-site.sh` once `render.yaml` is on `main`. It walks each step in the browser and checks the site works at the end.

# Security headers

Every response says what a browser may do with it (#225):

| Header                                                                     | Where it's set                                                                                                                   | What it's for                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`                                                  | Web app: `packages/web/vite.config.ts`. Landing: `packages/landing/astro.config.ts`. Both are a `<meta>` in each page, built in. | The only scripts, frames and connections a page may use: its own files, Stripe and the card form's font stylesheet from Google Fonts (web app), the API (landing) and Sentry. An injected script doesn't run. Inline styles are allowed. Not in dev. The end-to-end tests fail if a page has anything blocked. |
| `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY` | Both sites: `render.yaml`. Server: `src/middleware/security-headers.ts`.                                                         | No other site can show ours in a frame and trick people into clicking (clickjacking). A `<meta>` can't say this, so the host does.                                                                                                                       |
| `Strict-Transport-Security`                                                | `render.yaml`, server                                                                                                            | Browsers only ever use HTTPS for the site, for a year.                                                                                                                                                                                                   |
| `X-Content-Type-Options: nosniff`                                          | `render.yaml`, server                                                                                                            | A file is only ever treated as the type it says, so an upload or JSON answer can't be run as a script.                                                                                                                                                   |
| `Referrer-Policy`                                                          | `render.yaml` (`strict-origin-when-cross-origin`), server (`no-referrer`)                                                        | Other sites learn at most which site a visitor came from, never the page (whose address could hold a sign-in link).                                                                                                                                      |

The server's answers are data, never pages, so its own policy is `default-src 'none'`, and it doesn't send `X-Powered-By`. After a change, check the browser console on the test site while signing in (Google and email link), saving a card (and Link), paying a Bill by bank debit and sending the Quote form.
