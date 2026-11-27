# Web app

The one React app (ADR-0003), built with Vite: `pnpm dev` at the repo root starts it on http://localhost:5173. In dev, Vite forwards `/api` to the server (`API_URL`, by default http://localhost:3000), so the app and API share an origin and sign-in cookies work.

Screens are built from `@empire-cleaning/ui`, whose README has the components, Storybook and the browser setup the tests need.

A screen reads its data with `useLoaderData` from its route's `loader` (routes: `src/router.tsx`), through `getJson` (`src/api.ts`); every link is made with `linkTo()` (`src/links.ts`). Every link loads its page ahead when the pointer rests on it, it takes focus or it's pressed down (`src/preload.ts`), so a route's `beforeLoad` or `loader` with a side effect skips it when `preload` is true, or the route sets `preload: false`.

## First-time help

To add a tour, add it to its area's `src/screens/<area>/tours.ts` and walk to it in `e2e/tours.spec.ts` (`walkTour`), which fails unless each of an area's tours ends seen. That spec runs with `test.use({ showTours: true })`; for every other, the harness answers `/api/me` with every tour seen.

## Set at build time

- `VITE_SENTRY_DSN`: without it nothing is sent.
- `VITE_APP_MODE`: `test` on the test site, which shows the feedback button.
- `VITE_LANDING_URL`: the landing site, for the Sign in page's policy links; http://localhost:4321 unless set, the server's `LANDING_ORIGIN_URL`.
- `SENTRY_AUTH_TOKEN` and `SENTRY_ORG`: source maps go to Sentry's `web` project, never published (`packages/browser-monitoring`).

## Prototypes

A prototype is a `<screen>.prototype.tsx` under `src/screens/`, drawn at `/prototype/<screen>` as `src/screens/Prototype.tsx` says; the landing site's are in its README. Beside another dev server, give yours a port under 10000 with `--strictPort`: test runs lease theirs from 10000 up (`packages/server/tests/ports.ts`). Shots: `pnpm pr:shots --prototype` (Screenshots for a PR).

## Testing

End to end with Playwright (`e2e/`): a production build in Chromium against the real API and a real database on the test Postgres (`pnpm db:up`).

```sh
pnpm --filter @empire-cleaning/web test                                    # browser tests, then end to end
pnpm --filter @empire-cleaning/web test:e2e                                # end to end only
pnpm --filter @empire-cleaning/web exec playwright test e2e/bills.spec.ts  # one spec
pnpm --filter @empire-cleaning/server exec vitest run --changed main      # server tests changed since main
pnpm test                                                                  # every package's quick tests
```

Each worker has a slot of its own (`e2e/slots.ts`). 2 workers (ADR-0032); `E2E_WORKERS=6` or `--workers=6` sets it, `--workers=1` for one spec. A test reaches its API through `apiUrl` from `playwright.config.ts`, never a fixed port. A local run keeps its traces in `test-results/<first port of its block>` (`E2E_PORTS`: the server README, Testing).

The phone project runs every test; desktop only those tagged `@desktop`, where a larger layout changes something; `@smoke` is the quick set (`pnpm test:quick`). Tag with `test("…", { tag: "@desktop" }, …)`.

Only email, payments and the clock are faked, with the server tests' fakes (`packages/server/tests/e2e/server.ts`); the helpers, each with its use, are in `e2e/harness.ts`.

`pnpm test:change <spec>…`: a change in `src/` is in no spec, so name the specs for the screens you changed. A change to what a route's URL takes (a Tab, a search word, a path) reaches every spec that opens that URL: search the specs for the old value (`rg 'tab=all' packages/web/e2e`) and name each one (#433).

Small screen-only behaviour can use Vitest browser tests (`src/**/*.test.tsx`).

### What the fake covers, and what the sandbox run does

The fake never loads Stripe's form, so `e2e/card-form.sandbox.ts` types Stripe's test cards into the Payment Element against a Stripe sandbox, with the real Stripe adapter (`packages/server/tests/harness.ts`). It runs nightly (`.github/workflows/stripe-sandbox.yml`); run it by hand when `src/screens/portal/CardForm.tsx`, Stripe.js or the CSP changes, with Postgres up and a sandbox's keys in `packages/server/.env` (or `STRIPE_SANDBOX_SECRET_KEY` and `STRIPE_SANDBOX_PUBLISHABLE_KEY`): `pnpm --filter @empire-cleaning/web stripe:sandbox`. `pnpm test` and `pnpm test:change` take only `*.spec.ts`, so it's in neither.

### Screenshots for a PR

`pnpm pr:shots packages/web/e2e/<spec>.spec.ts "<test title>"` (a landing spec too, `packages/landing/tests/…`) runs one test on the branch's merge base and on this checkout, shoots its end at rest, pushes the PNGs to the `pr-media` branch and prints the table for **Before / after:**; copies stay in the git dir's `pr-shots/<first port>/` until the next run. `--desktop` when the larger layout differs.

Pick a test that ends on the changed screen as a person opens it, with no menu open; when none does, add one. A full-page shot can't show what a fixed bar covers at rest: add `--viewport` for the screen as the test left it.

On a branch older than a change to the shots harness (`prShot`), merge main in first, or the before is shot the old way (a landing spec then reads Different on every test). A test the base lacks runs there from the branch's tests; one failing on either side pushes nothing and says which.

`pnpm pr:shots --same <spec>…` (with `--desktop`, `--viewport`) is for a change that should leave every screen as it was: it compares every test's end byte for byte and prints "N of N identical". The base runs twice, and a test whose two base shots differ is listed as not compared: check it by eye. A test listed as different has its pair published: look at it.

`pnpm pr:shots --prototype <screen>` shoots a prototype's every layout × case, at the widths in `packages/server/tests/e2e/prototype-shots.ts` (`WIDTHS`), in this checkout alone, publishes nothing, and prints the path of the `index.md` showing them.
