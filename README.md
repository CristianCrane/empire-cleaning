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
