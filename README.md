# Dev

```shell
pnpm db:up                                   # Postgres in Docker, and the test Postgres on port 5433
pnpm dev                                     # every app, watching: the web app on :5173, the landing site on :4321
pnpm --filter @empire-cleaning/ui storybook  # the design system's catalogue, on :6006
pnpm db:down                                 # when done
```

Tests:

```shell
pnpm test:change e2e/bills.spec.ts  # before a PR, with the Checks (CI)
pnpm test                           # quick: design system, server and a few end-to-end journeys
pnpm test:full                      # every test
```

Each runs one package at a time and reports every failure; the browser tests need Chromium (`packages/ui/README.md`). The full suite runs on CI (ADR-0026).

`pnpm test:change` runs the package tests and every end-to-end spec the branch adds or edits, plus the specs you name (those for the screens you changed: `packages/web/README.md`), once each (`scripts/test-change.sh`). With two specs named it takes ~125 s alone and ~180-210 s beside another checkout's run.

# CI

Every PR and every push to `main` runs `.github/workflows/ci.yml`, each check in parallel; All checks passes only when every other one did, and is the one `main` requires. To run each locally (`pnpm db:up` first for the tests' Postgres):

| Check                | Locally                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Checks               | `pnpm check`, `pnpm lint`, `pnpm lint:unused`, `pnpm format:check`, `pnpm check:packages`, `pnpm db:generate` (below) |
| Server tests         | `pnpm --filter @empire-cleaning/server test:quick`                                                                    |
| Seed test            | `pnpm --filter @empire-cleaning/server test:seed` (`test` runs both; `SEED_SHARD=1/2` runs a share)                   |
| Design-system tests  | `pnpm --filter @empire-cleaning/ui test`                                                                              |
| Web end-to-end tests | `pnpm --filter @empire-cleaning/web test`                                                                             |
| Landing site tests   | `pnpm --filter @empire-cleaning/landing test`                                                                         |
| Docs                 | `node ~/.claude/hooks/docs.mjs check --base origin/main` (`docs/map.md`)                                              |

Fixing a check:

- `pnpm format` fixes the format check; `pnpm dedupe` fixes the lockfile's two copies (`check:packages`).
- A schema change needs its migration (`pnpm db:generate`), which needs no environment, so it also fails when a schema file starts loading the server's (#389).
- An index read that can't miss is written `days[0]!` (`noUncheckedIndexedAccess`); what an effect reads but shouldn't re-run for goes in `useEffectEvent` (`react/exhaustive-deps`); a parameter kept for its place is `_req`.
- Why each lint rule is on or off: `.oxlintrc.json`.

The typecheck, lint and format check read `packages/` only, so new TypeScript, a tool's too, goes in a workspace package, not beside the scripts. Each package exports its TypeScript source (`exports` in its `package.json`), so nothing is built first.

The pre-commit hook (`.githooks/pre-commit`, on after `pnpm install`) runs the lint and format check on staged files under `packages/`; `git commit --no-verify` skips it.

A failed end-to-end check keeps its Playwright report and traces as an artifact on the run: `pnpm --filter @empire-cleaning/web exec playwright show-trace <trace.zip>`.

CodeQL is GitHub's default setup (no workflow here), on `main` and every PR into it; alerts: `gh api repos/CristianCrane/empire-cleaning/code-scanning/alerts`. A PR's scan reports only on the lines it changes, so its pass shows a fix only when the diff covers the alert's line; the alert closes on `main`'s next scan.

# Test site

`render.yaml` (ADR-0020): a push to `main` deploys it once CI passes, each service only when the push changes a file in its `buildFilter` (ADR-0035), so a docs- or tests-only push deploys nothing. Fresh seed data: run the **Reset test data** Action (`.github/workflows/reset-test-data.yml`). From nothing: `scripts/setup-test-site.sh`, once `render.yaml` is on `main`.

# Production

`render-production.yaml`, its Auto Sync off. A change to one Blueprint goes in the other too: `packages/server/src/render-blueprints.test.ts` fails on any difference it doesn't list.

To release: in Render, open production's Blueprint, press Manual Sync if `render-production.yaml` changed since the last release, then Manual Deploy → Deploy latest commit on `empire-prod-server` (it migrates before it starts), `empire-prod-web` and `empire-prod-landing`. Creating it is on #205.

# Security headers

Set (#225) in `packages/web/vite.config.ts` and `packages/landing/astro.config.ts` (the CSP, a `<meta>`), `render.yaml` and `render-production.yaml` (the static sites), and `packages/server/src/middleware/security-headers.ts`; each says what it's for. After a change to one, check the browser console on the test site while signing in (Google and email link), saving a card (and Link), paying a Bill by bank debit and sending the Quote form.
