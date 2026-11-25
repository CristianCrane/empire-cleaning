# Tests: rules, and settling a question

How Empire Cleaning's tests are meant to be written, and how a question about them gets settled. Read this before writing a test, changing how tests start, stop or wait, or chasing one that fails or runs slow.

- **The rules** are what every test, and every change to how they run, keeps, each with the bug that taught it.
- **Settling a test question** gives this repo's specifics for showing a cause and timing a run.

How each package's tests work, and how to run them, is in its README (`packages/server`, `packages/web`, `packages/landing`, `packages/ui`). What runs before a PR is in the root `README.md` and ADR-0026.

## Rules

### Every test browser

**Every browser a test drives prefers reduced motion (`reducedMotion: "reduce"`), set once in each suite's config**: `use` in `packages/web/playwright.config.ts` and `packages/landing/playwright.config.ts`, and `contextOptions` in `packages/web/vitest.config.ts` and `packages/ui/vitest.config.ts`. pr:shots, the Stripe sandbox run and a spec's own `browser.newContext()` take it from there. The app stills every animation and transition under it (`packages/ui/src/tokens.css`), and they still run, for 0.01ms, so an overlay opens and closes through the same code. That rule gives every element a 0.01ms transition, so a style change (a resize, a class) shows from the next frame: read a box after one through a check that waits for what only the new layout has, `expect.poll` or `expect.element`, or after two animation frames, never straight after it (`packages/ui/src/Field.test.tsx`'s packed row, layout.spec's `problemsAtEveryWidth`, landing's steps three across). A poll for a value the old layout gives too passes at once, having checked nothing. Why: under CI's load, headless Chromium now and then froze for good mid-animation, and a click waiting for a still element timed out (main red at session.spec's "Sign out", run 45449021256; docs/testing-log.md, 2026-11-24). The one exception is a test of what the preference itself changes, which says so and takes `test.use({ reducedMotion: "no-preference" })`: landing's reviews, which scroll smoothly only with motion on.

### End-to-end tests (Playwright)

**Check accessibility with `expectAccessible(page)` from the package's harness, never axe directly**. That's `packages/web/e2e/harness.ts` or `packages/landing/tests/harness.ts`; lint stops a spec importing `@axe-core/playwright`. Both wait until nothing on the page is animating before they run axe, and web's also until what it checks, and everything around it, is fully opaque: an animation can be yet to start. Text checked mid-fade fails on contrast now and then, so the test passes locally and fails in CI at random: main went red this way after #228. In web, pass a selector to check only part of the page, such as an open dialog: `expectAccessible(page, "[role=dialog]")`. A failure lists each element with what's wrong, e.g. the two colours and their contrast. Web's also fails when the page shows a frame of another origin, such as Stripe's real card form, which axe can't check there. The design system's story tests run axe their own way (`packages/ui/README.md`).

**After editing a Quote Draft, wait for `saved(page)` before opening or measuring anything built from it**, such as the Schedule picker. A save reloads what's keyed on it (`saves`), which redraws it, so a `boundingBox()` or element handle read during that redraw can belong to a node that's already gone. Web-first assertions retry; `boundingBox()` reads only once. On main, the Schedule picker test failed 2 of 20 under load (`docs/testing-log.md`, 2026-11-09).

**Switch area with `switchArea(page, area)` from `packages/web/e2e/harness.ts`, never by pressing "Switch to …" and waiting on the URL.** Show the person's account first (`openAccount`: the sidebar's foot, the rail's Account, or a phone's ☰ menu); `switchArea` presses Switch to and waits until the new area is on screen. The URL changes at once, but until the new area is ready the old one stays on screen, so a test that goes on at the URL can press something in the old area, which the new one then throws away. It passed alone and timed out in every full local run (#310).

**Show that something didn't happen by what the page shows instead** (the `testing` skill, "Every check can fail"): the real card form's declined-card case waits for Payments' empty state, "Nothing paid yet", before it checks that no "Deposit" shows (#331, `packages/web/e2e/card-form.sandbox.ts`).

**Show that an action isn't on offer by opening what holds it** (the `testing` skill, "Every check can fail"): `expectNoPageAction` in `packages/web/e2e/harness.ts` rules out the page's buttons of that name (its next step, or its one action) and opens what holds the rest, More actions (the split button's arrow, its menu or a phone's sheet, or the ⋯ when nothing is next; #406, #432, #493), and each helper that does an action has a twin that rules it out.

**The real card form's spec** (`*.sandbox.ts`, run nightly; the rule: the `testing` skill, "A test no PR runs") finds each form it types a card into through `payAndBook`, `payThisBill` and `saveACard` in `packages/web/e2e/harness.ts`, and a quick spec checks the fake's form sits in each part where the sandbox types its card. What only the sandbox shows (Stripe's own frames, the Spanish form, the empty Payments it waits on after a declined card) is its alone. To see the sandbox itself on a branch, dispatch it there: `gh workflow run stripe-sandbox.yml --ref <branch>`.

### Payments

**Payments must keep working (#331): a change that touches paying names what proves paying still works, and a gap gets a test**, rather than a note of the risk. In the browser that's what the sandbox run covers (`packages/web/README.md`, "What the fake covers, and what the sandbox run does"); on the server, the Payment Gateway.

### Browser tests (Vitest)

**Web's and ui's browser tests run in UTC, whatever the machine's zone (`timezoneId` in each `vitest.config.ts`), and a test of New York's day takes an instant whose day in UTC is another, such as 10:30pm New York time.** Run in the machine's zone, `formatDate` with no time zone passed in New York, and an instant whose day is the same in both zones passes it anywhere (#369, `packages/web/src/screens/format.test.tsx`).

### Time budgets

**This repo's time budgets** (the rule, and how close a test runs to its budget: the `testing` skill). The server tests keep Vitest's 5 s, the seed test 120 s and the design system's story tests 30 s (each in its `vitest.config.ts`). The Stripe sandbox's contract keeps 6 min (`vitest.sandbox.config.ts`), and its failing refund's case 36 min, as Stripe has taken 30 to fail that refund (`REFUND_FAILS_WITHIN` in `packages/server/tests/contract/stripe-sandbox.ts`, #528). The end-to-end tests keep Playwright's 30 s, and `test.slow()` triples it for one test (`layout.spec.ts`, each with its reason).

### Starting and stopping

**A test run gets its databases from `claimTestDatabase`** (`packages/server/tests/setup/testDatabase.ts`), the one way, so they're named for the run (the `testing` skill; dropping a dead run's: `packages/server/README.md`, Testing). A claim is made in Vitest's own process (a global setup), where a lost hold can end the run: in a worker, Vitest turns `process.exit` into an error and the run goes on. Ports stay per checkout (`E2E_PORTS`, #312).

## Settling a test question

How a cause is shown and a run is timed: the `testing` skill. Here:

- **What a build leaves out, here** (the rule: the `change` skill's Build): Render builds each site as `render.yaml` and `render-production.yaml` say, `pnpm --filter-prod "@empire-cleaning/<web|landing>..." build` with its mode set (`VITE_APP_MODE` or `PUBLIC_APP_MODE`: `test` or `prod`), into `packages/<web|landing>/dist`. Build it that way in each mode and count the marker, a string only the left-out code holds, with `rg -c '<marker>' packages/<site>/dist`.
- **The shared test Postgres** has its own signs of strain: `packages/server/README.md`, Testing.
