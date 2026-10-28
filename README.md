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
pnpm test:full   # everything; run it before merging
```

Both run one package at a time and report every failure. See each package's README for what it covers.

5. clean up when finished:

```shell
pnpm run db:down
```

# CI

Every pull request to `main`, and every push to `main`, runs `.github/workflows/ci.yml`. Each part is its own check, and they run in parallel; a newer push to the same pull request cancels the run still going. To run the same locally (with `pnpm db:up` for the Postgres the tests use):

| Check                | Locally                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| Checks               | `pnpm check` (typecheck), `pnpm lint:check` (Prettier), `pnpm check:packages` |
| Server tests         | `pnpm --filter @empire-cleaning/server test`                                  |
| Design-system tests  | `pnpm --filter @empire-cleaning/ui test`                                      |
| Web end-to-end tests | `pnpm --filter @empire-cleaning/web test`                                     |
| Landing site tests   | `pnpm --filter @empire-cleaning/landing test`                                 |

CI starts `postgres_test` from `docker-compose.yml`, needs no secrets (email, payments and the clock are faked in tests), and builds `@empire-cleaning/models` first, since the other packages read its types from `dist`. When an end-to-end check fails, its Playwright report and the failed tests' traces are kept as an artifact on the run; open a trace with `pnpm --filter @empire-cleaning/web exec playwright show-trace <trace.zip>`.

# Test site

The test site (ADR-0020) is described in `render.yaml`: the server, its Postgres and the two static sites on Render, at `test.empirecleaningandpro.com` (landing) and `app.test.empirecleaningandpro.com` (web app, with `/api` rewritten to the server). A push to `main` deploys it once CI passes, and migrations run before each new server starts. Production is never deployed automatically.

`APP_MODE=test` makes it say so: a banner on every page, `[TEST]` on every email subject, and no search indexing. Its email goes only to `EMAIL_ALLOWED` addresses; the rest goes to the Office inbox with the intended recipient in the subject. To put fresh seed data on it, run the **Reset test data** Action (`.github/workflows/reset-test-data.yml`).
