# Web app

The one React app for the Office, Clients and Cleaners (ADR-0003), built with Vite. It talks to the server only through its JSON API. `pnpm dev` at the repo root starts it on http://localhost:5173.

Every screen is built from the design system in `packages/ui` (`@empire-cleaning/ui`). Its README covers the components, the Storybook catalogue and the browser setup the tests need.

## Areas and sign-in

| URL                           | For                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`                    | anyone: emailed link or Google                                                                                                                                                  |
| `/office`                     | Office Staff: Needs attention and today's Jobs with their Assignment status                                                                                                     |
| `/cleaner`                    | Cleaners: their Jobs today and coming up, Offered, Confirmed or Completed                                                                                                       |
| `/cleaner/jobs/$jobId`        | Cleaners: a Job they're on, where the Offer email leads; Confirm or Release their place, complete it, or record No Access                                                       |
| `/portal`                     | Clients: their upcoming and past Jobs, Bills, Quotes, Quote Requests and homes                                                                                                  |
| `/portal/jobs/$jobId`         | Clients: a Job: moving or cancelling it (with what it costs), its receipt, approving extra work, and paying an Unpaid Job; where those emails lead                              |
| `/portal/request`             | Clients: request a Quote for a new home or one of theirs                                                                                                                        |
| `/portal/details`             | Clients: contact details and Access Instructions                                                                                                                                |
| `/portal/quotes/$quoteId`     | Clients: a Quote, where its email's link leads; accept it in one step (Clean Type, card, pay), or Decline                                                                       |
| `/portal/payment-method`      | Clients: add or replace their card, where the Office's add-a-card email leads                                                                                                   |
| `/portal/bills/$billId`       | Clients: a weekly Bill, where its emails lead; printing it, and paying it by card or ACH Direct Debit while it's due                                                            |
| `/office/requests`            | Office Staff: open Quote Requests                                                                                                                                               |
| `/office/requests/$requestId` | Office Staff: a request in full, with the Suggested Price for both Clean Types and how each was worked out                                                                      |
| `/office/quotes/$quoteId`     | Office Staff: a Draft to price and send, or a Sent one, with recording acceptance and the add-a-card email                                                                      |
| `/office/price-list`          | Office Staff: edit the Price List                                                                                                                                               |
| `/office/schedule`            | Office Staff: booked Jobs and free Staff hours for a range of days, a week at a time by default                                                                                 |
| `/office/jobs/$jobId`         | Office Staff: a Job's places, confirming or turning down a Reschedule Request, moving or cancelling it, and once Completed, reviewing Adjustments and correcting the completion |
| `/office/staff`               | Office Staff: everyone on Staff, and inviting someone                                                                                                                           |
| `/office/staff/$staffId`      | Office Staff: a Staff member's usual week, days off and extra days, and deactivating them                                                                                       |
| `/office/clients/$clientId`   | Office Staff: a Client, their homes and Quote Requests, and Condition correction; for a business, weekly billing and their Bills                                                |
| `/office/bills/$billId`       | Office Staff: a weekly Bill, voiding it while unpaid, and recording a payment made another way                                                                                  |
| `/welcome`                    | an Account connected to nothing: request a Quote to become a Client                                                                                                             |
| `/`                           | sends a signed-in Account to its area                                                                                                                                           |

- Someone signed out who opens an area goes to `/sign-in?next=…` and comes back to that page afterwards.
- An Account opening another role's area is sent to its own area.
- Staff with both roles start in the Office and switch areas from the account menu.
- When a sign-in link has expired or been used, or a Google account has no Empire Cleaning Account, the person lands back on `/sign-in` with `?error=` and a plain explanation.

`src/session.ts` holds the Better Auth browser client (functions only, no UI), the areas and the signed-in Account, asked of `GET /api/me` once and remembered until sign-out. The route guards live in `src/router.tsx`.

The signed-in Account is remembered, not asked for on every click. The app asks `GET /api/me` again when the person switches to another area, comes back to the tab (`src/main.tsx`), or does something that can connect their Account to a record. That is when it can have changed behind the app's back: a Quote Request from the landing page, the Office adding a record, signing out in another tab.

In dev, Vite forwards `/api` to the server (`API_URL`, by default http://localhost:3000), so the app and the API share an origin and sign-in cookies just work. Production should do the same: serve the app and route `/api` to the server on one domain.

## Knowing where you are

Pages more than one step from their area's navigation start with `Breadcrumbs`, e.g. Requests › Casey Client. The navigation marks the section a page belongs to as current (`alsoCurrentFor` in `src/screens/AreaLayout.tsx`), so a Client reached from Requests keeps Requests highlighted.

## Links

Routing is TanStack Router, and design-system links (`Link`, AppLayout's nav) navigate through it. Every route is a named constant in `src/router.tsx`: written inline inside `addChildren()`, a route loses its types and so does every link. Screens read their data with `useLoaderData` from their route's `loader`, through `getJson` in `src/api.ts`. Every link is made with `linkTo()` from `src/links.ts`, which gives it the same checking as TanStack's own links: the route must exist, and its params must be given.

```tsx
<Link href={linkTo({ to: "/portal" })}>Home</Link>
```

A plain string or a hand-written `{ to }` object doesn't compile.

## Testing

End to end with Playwright (`e2e/`): a production build of the app runs in a real Chromium against the real API and a database of its own (`empire_e2e_test`, on the test Postgres).

**The phone is the main screen and runs everything; the desktop runs only the tests tagged `@desktop`**, those where a larger layout changes something (the sidebar, two-column prices, light-theme accessibility). Tests tagged `@smoke` are the quick set (`pnpm test:quick`). Tag a test with `test("…", { tag: "@desktop" }, …)`.

`e2e/layout.spec.ts` opens every screen at widths from 320px to 1440px and fails if an input is narrower than its text or the page scrolls sideways. The other tests read values from the DOM, which is there whether or not anyone can see it, so they can't notice text squeezed out of sight. Add new screens to it.

A test starts signed in with `signedInAs(page, email)`, which signs the person in for real through the control server and hands the browser the session; only the sign-in tests use the form, the email and the link (`signInWithLink`). Only email, payments and the clock are faked, with the same fakes the server tests use (`packages/server/tests/e2e/server.ts`). The payment forms are Stripe's Payment Element (`src/screens/portal/CardForm.tsx`, cards only, themed from the tokens), with the consent to later Charges beside them. The fake payment provider asks for its own "test" form instead, which needs no card typed; `failCharges()` makes Deposits fail and `requireApproval()` makes the Client's bank ask for approval, which the test form gives at once. Tests sign in by following the link from the captured email, exactly as a person would.

```sh
pnpm --filter @empire-cleaning/web test       # needs Postgres (pnpm db:up) and Chromium
pnpm --filter @empire-cleaning/web test:e2e   # just the end-to-end tests
```

Small screen-only behaviour can still use Vitest browser tests (`src/**/*.test.tsx`), as the design system does.
