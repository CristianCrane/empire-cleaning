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
