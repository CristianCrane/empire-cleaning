# Web app

The one React app for the Office, Clients and Cleaners (ADR-0003), built with Vite. It talks to the server only through its JSON API. `pnpm dev` at the repo root starts it on http://localhost:5173.

Every screen is built from the design system in `packages/ui` (`@empire-cleaning/ui`). Its README covers the components, the Storybook catalogue and the browser setup the tests need.

## Areas and sign-in

| URL                             | For                                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`                      | anyone: emailed link or Google                                                                                                                                                |
| `/office`                       | Office Staff: Needs attention and today's Jobs with their Assignment status                                                                                                   |
| `/cleaner`                      | Cleaners: their Jobs today and coming up, Offered, Confirmed or Completed                                                                                                     |
| `/cleaner/jobs/$jobId`          | Cleaners: a Job they're on, where the Offer email leads; Confirm or Release it, complete it, or record No Access                                                              |
| `/portal`                       | Clients: their upcoming and past Jobs, Bills, Quotes (asked for, offered and closed) and homes                                                                                |
| `/portal/jobs/$jobId`           | Clients: a Job: moving or cancelling it (with what it costs), its receipt, approving an Adjustment, and paying an Unpaid Job; where those emails lead                         |
| `/portal/request`               | Clients: request a Quote for a new home or one of theirs                                                                                                                      |
| `/portal/details`               | Clients: contact details and Access Instructions                                                                                                                              |
| `/portal/quotes/$quoteId`       | Clients: a Quote, where its email's link leads; accept it in one step (Service, card, pay), or Decline                                                                        |
| `/portal/payment-method`        | Clients: add or replace their card, where the Office's add-a-card email leads                                                                                                 |
| `/portal/bills/$billId`         | Clients: a weekly Bill, where its emails lead; printing it, and paying it by card or ACH Direct Debit while it's due                                                          |
| `/office/requests`              | Office Staff: open Quotes (Requested, Draft and Sent)                                                                                                                         |
| `/office/requests/$requestId`   | Office Staff: the Quote it became (an old address, redirected)                                                                                                                |
| `/office/quotes/$quoteId`       | Office Staff: a Quote as its story, newest first: what to do next, the Current Quote, and what happened to it; recording acceptance and the add-a-card email                  |
| `/office/quotes/$quoteId/draft` | Office Staff: the Revision being written, priced afresh as it changes (the Suggested Price's working folded under each price), and sending or deleting it                     |
| `/office/price-list`            | Office Staff: edit the Price List, and the Services each Add-on goes with                                                                                                     |
| `/office/schedule`              | Office Staff: booked Jobs and free Staff hours for a range of days, a week at a time by default                                                                               |
| `/office/jobs/$jobId`           | Office Staff: a Job's crew, confirming or turning down a Reschedule Request, moving or cancelling it, and once Completed, reviewing Adjustments and correcting the completion |
| `/office/staff`                 | Office Staff: everyone on Staff, and inviting someone                                                                                                                         |
| `/office/staff/$staffId`        | Office Staff: a Staff member's usual week, days off and extra days, and deactivating them                                                                                     |
| `/office/clients/$clientId`     | Office Staff: a Client, their homes and Quotes, and Condition correction; for a business, weekly billing and their Bills                                                      |
| `/office/bills/$billId`         | Office Staff: a weekly Bill, voiding it while unpaid, and recording a payment made another way                                                                                |
| `/welcome`                      | an Account connected to nothing: request a Quote to become a Client                                                                                                           |
| `/people`                       | anyone, on the test site only: sign in as a person from the demo (`?as=` first name, `?next=` the page after)                                                                 |
| `/`                             | sends a signed-in Account to its area                                                                                                                                         |

- Someone signed out who opens an area goes to `/sign-in?next=…` and comes back to that page afterwards.
- An Account opening another role's area is sent to its own area.
- Staff with both roles start in the Office and switch areas from the account menu.
- Show tips again, in the account menu, brings back first-time help's tours: every screen's shows once more.
- When a sign-in link has expired or been used, or a Google account has no Empire Cleaning Account, the person lands back on `/sign-in` with `?error=` and a plain explanation.

`src/session.ts` holds the Better Auth browser client (functions only, no UI), the areas and the signed-in Account with the first-time help tours it has seen (`seenTours`), asked of `GET /api/me` once and remembered until sign-out. The route guards live in `src/router.tsx`.

The signed-in Account is remembered, not asked for on every click. The app asks `GET /api/me` again when the person opens the Account menu, where they switch area, comes back to the tab (`src/main.tsx`), does something that can connect their Account to a record, or presses Show tips again. That is when it can have changed behind the app's back: asking for a Quote on the landing page, the Office adding a record, signing out in another tab. A tour seen is added to the remembered Account in place as well as sent to the API (`seeTour`), so it doesn't come back before the next look. Opening the Account menu also loads each area it offers, its Home included (`router.preloadRoute` in `AccountMenu`), so pressing one shows it at once; pressed before it's ready, the menu stays open, the row pending, until the area shows (#318).

The Office's Dashboard also asks again every minute while it can be seen (`src/screens/office/Dashboard.tsx`), so a new Quote request shows on a screen left open. The Office is emailed of each one too. Live updates (websockets) weren't worth it: a request is promised a Quote within a working day.

In dev, Vite forwards `/api` to the server (`API_URL`, by default http://localhost:3000), so the app and the API share an origin and sign-in cookies just work. Production should do the same: serve the app and route `/api` to the server on one domain.

## First-time help

First-time help's tours (not the test site's tours of its demo people, `/people`) show a screen's parts once, the first time it matters (`docs/ux.md`, First-time help). Each area's tours are plain data in one file, `src/screens/portal/tours.ts` for the Client portal, `src/screens/office/tours.ts` for the Office and `src/screens/cleaner/tours.ts` for the Cleaner area, listed in `src/screens/tours.ts` (every area has its own, or the typecheck fails): an id the Account remembers it by, the route it's for, and one to three steps, each pointing at what's pressed (a link or Button, on the screen before the navigation) by its text, or at a part (a Section, a labelled group) by its name. `useTours` (`src/screens/run-tours.ts`, run by AreaLayout) starts one each time the router has drawn a screen (so after Show tips again, a screen's tour shows on its next visit): the first for that route the Account hasn't seen whose every step is on the screen, through the design system's `startTour`. The first of an area's tours a person meets leads with its value line. Closing it, done or partway, marks it seen.

To add a tour, add it to its area's file and walk to it in `e2e/tours.spec.ts`. The walk through an area fails unless each of its tours ends up seen, so one whose step can't be found fails, and the spec fails while an area has no walk. Each walk goes through a tour from its data (`walkTour`), so a step's title and target are written once, in the tour. The spec runs with `test.use({ showTours: true })`; every other spec is spared the tours by the harness, which answers `/api/me` with every tour seen, in each browser a test opens (in the tours spec, each but the test's own page).

## Knowing where you are

Pages more than one step from their area's navigation start with `Breadcrumbs`, e.g. Requests › Casey Client. The navigation marks the section a page belongs to as current (`alsoCurrentFor` in `src/screens/AreaLayout.tsx`), so a Client reached from Requests keeps Requests highlighted.

## Links

Routing is TanStack Router, and design-system links (`Link`, AppLayout's nav) navigate through it. Every route is a named constant in `src/router.tsx`: written inline inside `addChildren()`, a route loses its types and so does every link. Screens read their data with `useLoaderData` from their route's `loader`, through `getJson` in `src/api.ts`. Every link is made with `linkTo()` from `src/links.ts`, which gives it the same checking as TanStack's own links: the route must exist, and its params must be given.

```tsx
<Link href={linkTo({ to: "/portal" })}>Home</Link>
```

A plain string or a hand-written `{ to }` object doesn't compile.

## Monitoring

Errors and about 20% of page loads go to Sentry (ADR-0007), set up in one place: `packages/browser-monitoring`, started in `src/main.tsx` and built in by `vite.config.ts`. Its README lists what may be sent and what mustn't.

- **Set at build time:** `VITE_SENTRY_DSN` (without it nothing is sent, as in dev and the tests) and `VITE_APP_MODE` (the environment: `test` on the test site). With `SENTRY_AUTH_TOKEN` and `SENTRY_ORG`, source maps are uploaded to Sentry's `web` project and never published. The release is the git commit, the same as the server's.
- **Feedback, on the test site only:** a floating Send feedback button on every page (`feedbackButton(feedbackLook)` in `src/main.tsx`, only when `VITE_APP_MODE` is `test`, so other builds leave its code and look out), so the owner can report what they find with a comment and a screenshot. `src/feedback.css` keeps it above the phone's tab bar and any `ActionFooter`; its look, under every Dialog in the app's colours and theme, is the design system's (`@empire-cleaning/ui/feedback.css`), shared with the landing site. `src/feedback.test.tsx` checks each.
- **Reported:** errors nothing caught, and every one a screen catches but didn't expect, through `reportUnexpected` (`src/monitoring.ts`); the lint rule `empire/report-unexpected` (`packages/lint`) holds every catch to it. Never the API's answers: a 5xx is reported by the server, and a 4xx is normal business. Nor a dropped connection, nor a card the Client couldn't use. Stripe's other errors (a wrong key, a bad request, Stripe failing) are ours, and reported (`cardProblem` in `src/screens/portal/CardForm.tsx`).
- **Traced:** page loads and page changes, named after their routes and linked to the API's traces of the calls they made.
- **Who:** the signed-in Account's ID (`identify` in `src/session.ts`), never their name or email.
- **Never sent:** session replay, form values, request bodies, cookies, console lines, or emails, phone numbers and query values anywhere in an event.

## Testing

End to end with Playwright (`e2e/`): a production build of the app runs in a real Chromium against the real API and a real database, on the test Postgres.

**Tests run in parallel, and each worker has a slot of its own** (`e2e/slots.ts`): an API with its control server and database (`empire_e2e_test_r<run>_0`, `_1`, …, named for the run as in the server README), and the built app served in front of it. A test only ever sees its own slot's data, emails and clock, so any test can run beside any other. There are 2 workers (why: ADR-0026); `E2E_WORKERS=6` or `--workers=6` sets it, and only that many slots start, so run one spec with `--workers=1`. Every slot's ports come from this checkout's block (`E2E_PORTS`, see the server README), so another checkout's run can go on at the same time. A test reaches its API through `apiUrl` from `playwright.config.ts`, never a fixed port. CI splits the suite across several jobs (`--shard`, `.github/workflows/ci.yml`).

**The phone is the main screen and runs everything; the desktop runs only the tests tagged `@desktop`**, those where a larger layout changes something (the sidebar, two-column prices, light-theme accessibility). Tests tagged `@smoke` are the quick set (`pnpm test:quick`). Tag a test with `test("…", { tag: "@desktop" }, …)`.

`e2e/layout.spec.ts` opens every screen at widths from 320px to 1440px and fails if an input is narrower than its text or the page scrolls sideways. The other tests read values from the DOM, which is there whether or not anyone can see it, so they can't notice text squeezed out of sight. Add new screens to it.

A test starts signed in with `signedInAs(page, email)`, which signs the person in for real through the control server and hands the browser the session; only the sign-in tests use the form, the email and the link (`signInWithLink`). Only email, payments and the clock are faked, with the same fakes the server tests use (`packages/server/tests/e2e/server.ts`). The payment forms are Stripe's Payment Element (`src/screens/portal/CardForm.tsx`, cards only, themed from the tokens), with the consent to later Charges beside them. The fake payment provider asks for its own "test" form instead, which needs no card typed; `failCharges()` makes Deposits fail and `requireApproval()` makes the Client's bank ask for approval, which the test form gives at once.

**What the fake covers, and what the sandbox run does.** The fake payment provider covers every screen's handling of a payment's outcome: paid, declined, approval asked, given or refused, a bank debit clearing. It never loads Stripe's form, so nothing here types a card, confirms with Stripe.js or meets 3D Secure. `e2e/card-form.sandbox.ts` does, against a Stripe sandbox: the same built app, under its CSP, and the same API with the real Stripe adapter in place of the fake (`packages/server/tests/harness.ts`), typing Stripe's test cards into the Payment Element. Its cases: accepting a Quote with a card (the Deposit taken and the card saved), with 3D Secure approved and failed, with a declined card; saving a card as the Payment Method; paying a Bill on its page. It runs nightly after the contract run (`.github/workflows/stripe-sandbox.yml`); run it by hand when `CardForm.tsx`, Stripe.js or the CSP changes, with Postgres up and a sandbox's keys in `packages/server/.env` (or `STRIPE_SANDBOX_SECRET_KEY` and `STRIPE_SANDBOX_PUBLISHABLE_KEY`): `pnpm --filter @empire-cleaning/web stripe:sandbox`. It's outside `pnpm test` and `pnpm test:change`, which take only `*.spec.ts`. Tests sign in by following the link from the captured email, exactly as a person would.

Check accessibility with `expectAccessible(page)` from `e2e/harness.ts`, and switch area with `switchArea(page, area)`: `docs/testing.md` has both rules and the bugs behind them.

```sh
pnpm --filter @empire-cleaning/web test       # needs Postgres (pnpm db:up) and Chromium
pnpm --filter @empire-cleaning/web test:e2e   # just the end-to-end tests
```

While working on a change, run only what it touches (the root `README.md` says what runs before the PR):

```sh
pnpm test:change e2e/bills.spec.ts                                         # the specs the branch adds or edits and the specs named, once each, and the other packages' tests
pnpm --filter @empire-cleaning/web exec playwright test e2e/bills.spec.ts  # one spec
pnpm --filter @empire-cleaning/server exec vitest run --changed main      # server tests affected by changes since main
pnpm test                                                                  # the @smoke set and quick suites of every package
```

`pnpm test:change` finds the specs the branch adds or edits from git, but a change in `src/` is in no spec: name the specs for the screens you changed. It doesn't use Playwright's `--only-changed`, which takes every spec importing a changed file too, so an edit to `e2e/harness.ts` would run nearly all of them.

**Screenshots for a PR.** A PR that changes a screen shows it before and after in its body. `pnpm pr:shots packages/web/e2e/people.spec.ts "<test title>"` (add `--desktop` when the larger layout differs) runs one test twice, a landing site spec too (`packages/landing/tests/…`), and takes a full-page screenshot at its end: before on the branch's merge base with origin/main, in a worktree beside this checkout (`<checkout>-shots-base`, gone when the run ends), and after in this checkout. Each side runs with its own checkout's Playwright, slots, databases and ports (`packages/server/tests/e2e/shots.config.ts` wraps the package's config). The PNGs go to the orphan `pr-media` branch, in a folder named after the branch, so the public PR shows them inline, and it prints the table to paste under **Before / after:**. A test the base doesn't have gives an after alone; a test that fails on either side, or a title that names no test or several, pushes nothing.

Small screen-only behaviour can still use Vitest browser tests (`src/**/*.test.tsx`), as the design system does.
