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

`render.yaml` (ADR-0020). It deploys once a night (ADR-0037): the **Deploy test site** Action (`.github/workflows/deploy-test-site.yml`, 03:23 New York) deploys each service at `main`'s newest commit that passed CI, when a file in its `buildFilter` (ADR-0036) or its block in `render.yaml` changed since its last good deploy. Render's own auto-deploy is off, but a `render.yaml` change still deploys what it touches at the merge, before CI, as Render syncs the Blueprint.

To deploy at once: run the Action by hand (Actions → Deploy test site → Run workflow; tick "Only say what would deploy" for a dry run), or in Render, a service's Manual Deploy → Deploy latest commit, which deploys `main`'s head whatever CI says. The Action deploys through each service's deploy hook, kept as secrets in the `test-site-deploy` environment, which only `main`'s runs can read; `scripts/setup-test-site.sh`'s stage 9 limits it to `main` and sets the three hooks, and until then the Action deploys nothing and says why (#205). A leaked hook is regenerated on the service's Settings → Deploy Hook, then set with `gh secret set RENDER_DEPLOY_HOOK_EMPIRE_TEST_<SERVICE> --env test-site-deploy`.

Fresh seed data: run the **Reset test data** Action (`.github/workflows/reset-test-data.yml`). It and **Add testers** run the code the test server runs, not `main`'s head, as the seed writes its tables. Each run's summary says which commit that is and how far behind `main`, and a run whose seed files changed on `main` since that deploy stops, saying to deploy first. From nothing: `scripts/setup-test-site.sh`, once `render.yaml` is on `main`.

# Production

`render-production.yaml`, its Auto Sync off. A change to one Blueprint goes in the other too: `packages/server/src/render-blueprints.test.ts` fails on any difference it doesn't list.

To release: in Render, open production's Blueprint, press Manual Sync if `render-production.yaml` changed since the last release, then Manual Deploy → Deploy latest commit on `empire-prod-server` (it migrates before it starts), `empire-prod-web` and `empire-prod-landing`. Creating it is on #205.

# Security headers

Set (#225) in `packages/web/vite.config.ts` and `packages/landing/astro.config.ts` (the CSP, a `<meta>`), `render.yaml` and `render-production.yaml` (the static sites), and `packages/server/src/middleware/security-headers.ts`; each says what it's for. After a change to one, check the browser console on the test site, once the change has deployed there, while signing in (Google and email link), saving a card (and Link), paying a Bill by bank debit and sending the Quote form.
