# Tests: rules, and settling a question

How each package's tests run is in its README.

## Rules

### Every test browser

**Every browser a test drives prefers reduced motion (`reducedMotion: "reduce"`), set once in each suite's config.** The app still runs every animation, for 0.01ms (`packages/ui/src/tokens.css`), so an overlay opens and closes through the same code. Chromium can keep a finished 0.01ms transition in `document.getAnimations()`, so a wait for a still page counts only unfinished ones. Why: on CI, headless Chromium froze mid-animation and a click waiting on it timed out (run 45449021256, #574). A test of what the preference itself changes says so and takes `test.use({ reducedMotion: "no-preference" })`, as landing's reviews do.

**A page draws its next step in more than one copy, one there to press at a time** (the title row's, the header that sticks from md, a phone's foot; a Form page's price too). A role query skips `display: none` and `aria-hidden` but not `inert` alone, and counts `opacity: 0` or a box moved off screen as visible; `getByText` matches hidden text too. So a check picks the shown copy by role (a `status` filtered by its text) and polls the locator, as an element taken once (`.element()`, a handle) is that moment's copy (PR #527, PR #503).

### End-to-end tests (Playwright)

**Check accessibility with `expectAccessible(page)` from the package's harness, never axe directly** (lint stops a spec importing `@axe-core/playwright`). It waits until nothing is animating and, in web, until what it checks is fully opaque, as text checked mid-fade fails on contrast at random (main red after #228). In web, a selector checks part of the page: `expectAccessible(page, "[role=dialog]")`. Web's also fails on a frame of another origin, such as Stripe's card form, which axe can't check. The design system's story tests run axe their own way (`packages/ui/README.md`).

**Every screen is in `packages/web/e2e/layout.spec.ts`, in its wordiest state too, not only as it opens, and a Guest's or Client's in Spanish too (`expectFitsInBoth`).** It opens each at every width from 320px to 1440px, and only it sees text squeezed out of sight, as the other tests read the DOM. Office > Draft quote's longest picker button ran the page to 423 px wide unseen (PR #545).

**After an edit on Office > Draft quote, wait for `saved(page)` before opening or measuring anything built from it**, such as its open times. A save reloads what's keyed on it (`saves`), which redraws it, so a `boundingBox()` or element handle read during that redraw can belong to a node that's already gone. Web-first assertions retry; `boundingBox()` reads only once. A test that didn't wait failed 2 of 20 under load (#373, PR #376).

**A test moves time with `setClock` (the API's clock and every browser's), never the browser's clock alone.** `page.clock.pauseAt` stops the page's timers and animation frames too, so a test pauses only around the load it times: a phone's ☰ menu never finished closing (#454).

**Switch area with `switchArea(page, area)` from the harness, never by pressing "Switch to …" and waiting on the URL.** Show the person's account first (`openAccount`); `switchArea` presses Switch to and waits until the new area is on screen. The URL changes at once but the old area stays until the new one is ready, so a test going on at the URL can press something in the old area, which the new one throws away. It passed alone and timed out in every full local run (#310).

**Where the app writes a no-break space (before a time's AM/PM, around a row's ` · `), an e2e regex writes `\s` there** (`/^Saved(\s·\s.+)?$/`, a `new RegExp` from a template too): Playwright folds whitespace in an expected string but tests a regex against the text as it is. A check that folds nothing (`toContain` on an email's text, a unit test's expected value) writes `\u00a0`. A plain-space pattern in an absence check passes whatever the page shows (#548, #534).

**Show that something didn't happen by what the page shows instead** (the `testing` skill, "Every check can fail"): the real card form's declined-card case waits for Client portal > Payments' empty state, "Nothing paid yet", before it checks that no "Deposit" shows (#331, `packages/web/e2e/card-form.sandbox.ts`).

**Show that an action isn't on offer by opening what holds it** (the `testing` skill, "Every check can fail"): `expectNoPageAction` in `packages/web/e2e/harness.ts` rules out the page's buttons of that name (its next step, or its one action) and opens what holds the rest, More actions (the split button's arrow, its menu or a phone's sheet, or the ⋯ when nothing is next; #406, #432, #493), and each helper that does an action has a twin that rules it out.

**The real card form's spec** (`*.sandbox.ts`, run nightly; the rule: the `testing` skill, "A test no PR runs") finds each form it types a card into through `payAndBook`, `payThisBill` and `saveACard` in `packages/web/e2e/harness.ts`, and a quick spec checks the fake's form sits in each part where the sandbox types its card. What only the sandbox shows (Stripe's own frames, the Spanish form, Client portal > Payments empty after a declined card) is its alone. To see the sandbox itself on a branch, dispatch it there: `gh workflow run stripe-sandbox.yml --ref <branch>`.

### Payments

**Payments must keep working (#331): a change that touches paying names what proves paying still works, and a gap gets a test**, rather than a note of the risk. In the browser that's what the sandbox run covers (`packages/web/README.md`, "What the fake covers, and what the sandbox run does"); on the server, the Payment Gateway.

**A fake answers in the provider's shape, field for field, or a bug behind the gap passes**: the fake's "processing" charge had no id and closed as failed, where Stripe's keeps its id and stays open, so a second payment on a Bill meanwhile passed unseen (#533); the fake let a succeeded payment be cancelled, which Stripe refuses, and a test passed with the Client's money gone (PR #546).

**What Stripe.js answers in the browser can be shown, not left a guess**: a sandbox's keys in `packages/server/.env`, an intent made with the secret key, and Stripe.js in headless Chromium on a plain local page (pressing 3D Secure's test page in its frames). That's how the `_authentication_failure` codes were shown, against the type a reviewer recalled (PR #354).

### Server tests (Vitest)

**The server's test clock stands still, so two `clock.now()` reads in one request always agree; a test of their order makes it tick on each read** (`vi.spyOn(testClock(), "now")`, as assignments.test.ts's "is booked the moment its Deposit is taken", #493).

### Browser tests (Vitest)

**Web's and ui's browser tests run in UTC, whatever the machine's zone (`timezoneId` in each `vitest.config.ts`), and a test of New York's day takes an instant whose day in UTC is another, such as 10:30pm New York time.** Run in the machine's zone, `formatDate` with no time zone passed in New York, and an instant whose day is the same in both zones passes it anywhere (#369, `packages/web/src/screens/format.test.tsx`).

**jest-dom's `toBeVisible` counts `opacity: 0` as hidden, and an overlay just opened is at opacity 0 for its first frame, reduced motion or not: check it once seen, `waitFor(() => expect(it).toBeVisible())`** (PR #440). A role query, unlike it, counts opacity 0 as visible.

### Time budgets

**This repo's time budgets** (the rule, and how close a test runs to its budget: the `testing` skill). The server tests keep Vitest's 5 s, the seed test 120 s and the design system's story tests 30 s (each in its `vitest.config.ts`). The Stripe sandbox's contract keeps 6 min (`vitest.sandbox.config.ts`), and its failing refund's case 36 min, as Stripe has taken 30 to fail that refund (`REFUND_FAILS_WITHIN` in `packages/server/tests/contract/stripe-sandbox.ts`, #528). The end-to-end tests keep Playwright's 30 s, and `test.slow()` triples it for one test (`layout.spec.ts`, each with its reason).

### Starting and stopping

**A test run gets its databases from `claimTestDatabase`** (`packages/server/tests/setup/testDatabase.ts`), the one way, so they're named for the run (the `testing` skill; dropping a dead run's: `packages/server/README.md`, Testing). A claim is made in Vitest's own process (a global setup), where a lost hold can end the run: in a worker, Vitest turns `process.exit` into an error and the run goes on. An e2e run's ports are its own the same way: it leases a free block of them for as long as it lives, so nobody picks one (`packages/server/tests/ports.ts`; the server README, Testing).

## Settling a test question

How a cause is shown and a run is timed: the `testing` skill. Here:

- **What a build leaves out, here** (the rule: the `change` skill's Build): Render builds each site as `render.yaml` and `render-production.yaml` say, `pnpm --filter-prod "@empire-cleaning/<web|landing>..." build` with its mode set (`VITE_APP_MODE` or `PUBLIC_APP_MODE`: `test` or `prod`), into `packages/<web|landing>/dist`. Build it that way in each mode and count the marker, a string only the left-out code holds, with `rg -c '<marker>' packages/<site>/dist`.
- **One timeout under heavy load spills into the next tests of its file**: their reset deadlocks on a `delete from` (`deadlock detected`), or a send is refused as untimely, as the timed-out test is still writing. So read a file's first failure, not the count (#550).
- **The shared test Postgres** has its own signs of strain: `packages/server/README.md`, Testing.
