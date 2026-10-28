# Express server starter

## Testing

`pnpm test` runs the suite on the **test Postgres** (`docker-compose.yml`, port 5433). Start it with `pnpm db:up`. Test files run in parallel, and each Vitest worker has a database of its own (`empire_test_1`, `empire_test_2`, …; `tests/setup/workerDatabase.ts`). On every run `empire_test` (override with `TEST_DB_URL`) is dropped, recreated and migrated from `drizzle/`, and the workers' databases are copied from it (`CREATE DATABASE … TEMPLATE`), so the migrations run once.

The test Postgres lives in memory with disk syncing off. Committing to disk took tens of milliseconds a time on a Docker volume (47 ms measured), and a test run makes thousands of commits. Test data is disposable, so nothing is lost. Never put real data there.

Tests exercise external behaviour through the seams in `tests/harness.ts`:

- `api()` drives the real Express app over HTTP via supertest (`apiAgent()` keeps cookies between requests)
- `testClock()` controls the time read through `#services/clock`
- `testPayments()` is a fake Payment Gateway that records Charges and refunds, and repeats nothing for a repeated idempotency key. It can be told to decline (`failCharges()`), to want the bank's approval for a card entered now (`requireApproval("approved" | "refused" | "pending")`) or to be unreachable (`goDown()`). Its forms are the web app's "test" ones: a card entered now is any token starting `tok_test` (`paymentToken()`), and any save-only form secret it handed out saves as "Test card ending 4242". Its webhooks are the event as JSON with an `x-fake-signature` header (`FAKE_SIGNATURE`)
- `testEmail()` captures every email sent through `#services/email`

Fakes are fresh and every table is emptied before each test, with one `DELETE` transaction (`resetDatabase`). Not `TRUNCATE`: that creates and syncs fresh files for every table and index, which took about 4 s per test here and more with every table added.

A worker's test files share one loaded copy of the server (`isolate: false`), because loading it takes about 5 s. That is safe because a worker runs its files one at a time and every test starts clean (`tests/setup/perTest.ts`); running them in random order (`pnpm vitest run --sequence.shuffle.files --sequence.shuffle.tests`) is a way to check.

## Accounts and sign-in

Better Auth (ADR-0002) is mounted at `/api/auth/*`; signing up and in are by emailed one-time link or Google, never a password. `GET /api/me` returns the signed-in Account.

Accounts come only from signing up, so an Account's email is always proven (ADR-0006). Clients (`#features/clients`, created by asking for a Quote) and Staff (`#features/staff`, created by invitation or the owner setup below) are separate records. An Account is connected to the records whose email matches its own, at sign-up, at every later sign-in, and straight away when a record is added for an email that has already signed up. A connection is stored once made, so it survives either email changing. An Account connected to nothing has no roles.

Protect an endpoint with `authorize()` from `#features/auth`. Roles come from the caller's connections: the roles of an active Staff member, plus `client` for a connected Client.

- `authorize()` allows any signed-in Account, even one connected to nothing.
- `authorize("office_staff")` allows only Accounts holding that role. Guests get a 401, and the wrong role gets a 403.

Inside the handler, `signedInAccount(res)` returns the caller.

Create the first Office Staff member (after `pnpm db:migrate`), then sign up with that email:

```sh
pnpm auth:create-owner owner@example.com "Owner Name"
```

Or, for a dev database, seed it instead: `pnpm db:seed` makes the owner (`SEED_OWNER_EMAIL`), Cleaners, and Clients with Quotes in every state, dated around today (`tests/seed.ts`). `pnpm db:seed --reset` first deletes everything but Accounts, the Price List and the Services, so a reset keeps everyone signed up.

The server refuses to start, in dev and prod alike, without `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `OFFICE_EMAIL` (the Office's shared inbox), `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (a Stripe sandbox's in dev; see Accepting a Quote) and `CORS_ORIGIN_URL` (the web app's address): copy `.env.example` to `.env` and fill them in. `BETTER_AUTH_URL` is this API's public URL (sign-in links point at it). Tests supply fake values and fake the services behind them.

In tests, `signIn(email)` from `tests/harness.ts` signs up or in the way a person does and returns a signed-in agent; add the Staff or Client record first for it to connect to.

## Asking for a Quote

A Quote holds what was asked for it, unchanged (ADR-0017). `POST /api/quotes/ask` is open to Guests (the landing site) and signed-in Accounts (the portal), and starts a Quote at Requested. It creates the Client and Property as needed, but never an Account (ADR-0006):

- **A Guest** sends contact details. If a Client already has that email, the Quote is added to that Client and their details are left as they are.
- **An Account connected to no Client** sends a name and phone, and becomes a new Client with its proven email, connected straight away.
- **A Client** sends neither: just a new home or one of their own.

- **A home or business premises** (#72). A Property is `residential`, described by its rooms, or `commercial`, described by a Premises Type (by key) and an optional floor area. A home's ask states its Condition and may choose Add-ons; a business's gives its business name (required for new premises), and either the weekdays (0 is Monday) and a preferred start time it wants cleaned, or none for a one-off. It states no Condition or Add-ons: a Site Visit finds those (#73), so business premises have no Condition until Office Staff record one. A business name fills in a Client that has none, from the Client themselves or the Office, never from a Guest using an existing Client's email, and never renames one.
- **One address is one home** per Client. Addresses are compared after normalising capitals, punctuation, spacing and common abbreviations (`features/properties/address.ts`), so "41-12 Austin Street, Apt 4B" is "41 12 austin st #4b". A different unit is a different home. Entering a known address again uses that home with the details it was first given, and only restates its Condition.
- **No asking again while a Quote is open.** A Property has at most one open (Requested, Draft or Sent) Quote of each kind, and a Requested one counts as both, so asking about a Property with any open Quote is refused with a 409 and a plain message. Asking after one Expired, Declined, Accepted or Turned Down starts a new Quote.
- **The receipt** goes to the Client's own address, with a plain link to the Quote's page in the portal (`/portal/quotes/:id`) and no sign-in power. Only a Client's own ask sends one. If it can't be sent, the Quote is still saved and the failure is logged.
- **A caller** (#34). `POST /api/quotes/caller` (Office Staff) enters what someone asked by phone, for a Client they found or a new one whose email is optional (ADR-0012), and starts its first Revision straight away: it's a Draft, and no receipt is sent.

Validation messages are written to be shown beside the form's fields.

- `GET` and `PATCH /api/clients/me` are a Client's own record and contact details.
- `GET /api/clients/:id` (Office Staff) is any Client.
- `PATCH /api/properties/:id/access-instructions` is open to the Client or Office Staff.
- `PATCH /api/properties/:id` (Office Staff only) corrects a home's details (type, bedrooms, bathrooms, floors, pets, floor area and Condition) or business premises' (Premises Type, floor area and Condition). Its address is its identity and isn't correctable, and nor is its kind.
- `PATCH /api/clients/:id` (Office Staff) may also set or clear a business name. Everywhere the Office sees a Client named, it has `businessName` beside `name`.

## Services, the Price List and the Suggested Price

A Suggested Price comes from the Price List and one Service (ADR-0018).

**Services** (`#features/services`) are what Empire Cleaning sells, each with its own pricing method (`rooms`: its own hours for each part of a home, `roomHours`; `area`: hours per 1,000 sq ft), hourly rate, Minimum Charge, one-off and plan tax rates, and flags (Condition applies, can recur, needs a Site Visit, a first-visit recommendation). Every save is a new row with the same `key`; a Service's current version is its latest, and retiring one is saving it inactive. A Revision option records the Service version it priced with (`service_id`). The first read creates five with fixed keys (`SEEDED`, in `seeded.ts`): Standard, Deep and Move-in/out Clean for homes, commercial cleaning by area, and Painting by area for both, with placeholder figures and neither Condition nor Premises Type. A Job records the Service version it was priced with (`jobs.service_id`), and is named by it in every view and email (`serviceNameOf`, `serviceVersions`: versions never change, so they're cached). Each Add-on on the Price List lists the Services it goes with (`serviceKeys`); `GET /api/price-list/add-ons?service=<key>` names those for one Service, by default a home's first.

- `GET /api/services` (Office Staff) lists them, active and retired; `GET /api/services/:key` reads one.
- `POST /api/services` adds one at the end of the list; `PUT /api/services/:key` saves a new version. Two active Services can't share a name, and a first-visit recommendation must be another Service.

The Price List (`#features/price-list`) holds the rest: the Condition multipliers, Premises Types (a multiplier each, against an office), Add-ons, Quote defaults and the fee tax rate. Money is in cents, before tax. **Every save is a new version**, never an edit, so a Quote can point at the exact version it used; the current one is the latest. The first read creates version 1 from placeholder figures (`placeholder: true`) until Office Staff save their own.

- `GET` and `PUT /api/price-list` (Office Staff) read and save it. A save sends the whole list.
- `GET /api/price-list/add-ons` is open to everyone: the names of the Add-ons on offer for homes, never prices (the landing page's form lists them). Each Add-on is `offeredFor` homes, businesses or both; a Quote offers those for its Property's kind.
- `GET /api/price-list/premises-types` is open to everyone too: the Premises Types on offer, by name.
- **Add-ons and Premises Types are never deleted.** Leaving one out of a save retires it, with the same key, so what chose or used it still prices. A save must leave at least one Premises Type on offer.
- `GET /api/quotes/:id` (Office Staff) returns a Quote in full with the Service it's for (`service`), those a one-off Draft can be changed to (`serviceChoices`), and its Suggested Price (`suggested.prices`): its Service's, after the first-visit recommendation's where that's offered, worked out now from the current Price List and Services and the Property's current details and Condition.

The calculation (`suggested-price.ts`):

```text
rooms          = base + bedrooms + bathrooms + (floors - 1) + pets, at the Service's hours each
area           = the Revision's area / 1,000 x the Service's hours per 1,000 sq ft, x the
                 Premises Type where Condition applies (0 until an area is known)
Labour Hours   = those hours x Condition (where it applies), plus each Add-on's own hours
                 (not multiplied), rounded UP to the quarter-hour; no Condition yet is moderate
price          = Labour Hours x the Service's hourly rate, to the whole dollar, at least
                 its Minimum Charge
tax            = the Service's one-off rate on the price, less tax-exempt Add-ons' share;
                 a plan Job, and its Adjustments, the Service's plan rate
```

It uses whole numbers throughout (hours in 1e-4, multipliers in hundredths), so a quarter-hour boundary is never missed by floating point: 3 x 0.4 h + 0.55 h is exactly 1.75 h, though it is 1.7500000000000002 as decimals.

## Staff, availability and the Schedule

Everything here is for Office Staff. Days are Empire Cleaning's own, in New York (`#services/clock`: `dayOf`, `startOfDay`), written `2026-11-03`: a Job at 9pm on the 3rd is on the 3rd, though it is the 4th in UTC.

- `GET /api/staff` lists everyone ever invited, active first. Each has an `imageUrl`: their Google profile picture, refreshed at every Google sign-in (`overrideUserInfoOnSignIn`), or null until they've used Google. `POST /api/staff` invites someone by name, email and roles. It creates a Staff record, never an Account (ADR-0006), and emails a link to the sign-in page; the email itself grants nothing. Inviting a deactivated member again brings them back with the roles given now; inviting an active one is a 409.
- `POST /api/staff/:id/deactivate` ends their Staff access at once and leaves their Account and any Client untouched. The last active Office Staff member can't be deactivated (409).
- `GET /api/staff/:id` includes their availability: a **usual week** (hours per weekday, Monday first; `PUT /api/staff/:id/usual-week`) and **exceptions** for single days, which replace that day's usual hours (`PUT` and `DELETE /api/staff/:id/exceptions/:date`). Hours are in quarter-hours.
- `GET /api/schedule?from=&to=` returns each day of the range (at most 62): its booked Jobs, the Staff hours available, the Labour Hours booked and the difference, and the new times pending Reschedule Requests hold (`held`). **Only active Cleaners' hours count**, as Labour Hours are cleaning time.
- **Room** for a clean at a time (`roomFor()`, `roomOn()` for a day already fetched) takes two rules: the **hours** rule (the day's free hours cover its Labour Hours) and the **headcount** rule (#62: the most crews at work at once during its time on site, Jobs and held times both, plus its own Crew Size, are no more than the day's Cleaners with Available Hours). Only time on site counts, not travel. A Job being moved passes its `jobId`, so it isn't counted against itself. Accepting a Quote, asking for, confirming and moving to a new time, and Service Plan Jobs all call it, holding the day with `lockDay`; the web pickers mirror the headcount rule in `crewAt()` (`web/src/screens/schedule-layout.ts`).
- `GET /api/schedule/capacity?date=&time=&labourHours=&crewSize=(&jobId=)` says whether a clean has room then, and why not.
- **Site Visits** are on each day too (`siteVisits`). One by a Cleaner with Available Hours that day (`takesRoom`) counts like a Job with a Crew Size of one, its length as its Labour Hours, in `bookedHours` and the headcount rule, so every room check above counts it; one by Office Staff alone takes none. See Site Visits below.

Jobs (`#features/jobs`) hold only what the Schedule needs so far: Property, Service version, start, Labour Hours, Crew Size, a `booked` status, when it was booked (by the Clock) and when its reminder went. Accepting a Quote books them; tests about the Schedule itself use `bookedJob()` from `tests/fixtures.ts` (and the e2e control server's `POST /jobs`).

## Office dashboard

`#features/dashboard`, for Office Staff only.

- `GET /api/dashboard/needs-attention` lists what is waiting on the Office, a kind at a time in the order to deal with them. Each item has a `kind` and that kind's own record: `quote_no_room` for Sent Quotes whose day has filled up so none of their Services fits (soonest proposed first; see below), `quote_requested` for Quotes asked for with no Revision Sent yet, longest waiting first, and `quote_expiring` for Sent Quotes within 48 hours of Expiring, soonest first. **To add a kind**, add its type to `NeedsAttentionItem` in `@empire-cleaning/models` and its source to `sources` in `needs-attention.ts`; the web app's `Dashboard.tsx` then needs its case to compile.
- `GET /api/dashboard/today` is today's Schedule day (per the Clock, in New York), with each Job's `assignment` and its `outcome` once it has happened: `completed` or `no_access`.

## Quotes

`#features/quotes` (ADR-0011, ADR-0017). A Quote belongs to a Property and keeps what was asked (none on one the Office offered unprompted) and a series of **Revisions**, each a priced offer. A Revision is drafted, then Sent, and never changes once Sent; the latest Sent one is the offer. A Quote is `requested`, `draft`, `sent`, `accepted`, `declined`, `expired` or `turned_down`, and its kind (`one_off` or `service_plan`) is set by its first Revision and then fixed. A Quote is for one **Service** (ADR-0018): the one asked for (`serviceKey` on the ask; without one, the first on offer for the kind of Property, until the form asks), kept as asked (`asked.service`), which Office Staff may change on a one-off Draft. A one-off Quote offers its Service, and, where the Service names a first-visit recommendation and the Property has no Completed Job, that one too, first and recommended (Standard recommends Deep), each with its own price, tax, total, Labour Hours and Deposit; a Service Plan Quote, a clean on each of its weekdays at the plan's price, each of its own Service from those that can recur. A Property has at most one open one-off Quote per Service and one open Service Plan Quote (`openAlongside`; partial unique indexes back it up); a Requested Quote counts as its Service's one-off and, if that can recur, as the Service Plan Quote. A Quote for a Service that needs a Site Visit can't be Sent until findings are recorded; a Service Plan Quote needs the Property's First Clean (its first Completed one-off Job of a Service that can recur) unless every day's Service needs a Site Visit.

- **The Office's list**. `GET /api/quotes` (Office Staff) is the open Quotes (Requested, Draft and Sent), newest first, with those Expired in the last 30 days (`RECENTLY_EXPIRED_DAYS`), which may be revived.
- **Drafting** (Office Staff). `POST /api/quotes/:id/revisions` with `{ kind? }` starts the Draft Revision, pre-filled from the Suggested Price, the Add-ons asked for and the Price List's Crew Size, Deposit percentage and validity (201); a Quote drafts one Revision at a time, so if it has one that's returned (200). A Requested Quote's first sets its kind (one-off unless said otherwise) and makes it a Draft; a Service Plan needs the home's First Clean Completed. A later Revision starts from the offer's terms and leaves the Quote Sent until it's sent. `PATCH /api/quotes/:id/draft` saves a one-off Draft's Service (`serviceKey`, refused while another Quote for it is open here), Add-ons, Crew Size, Deposit, validity, the proposed time (New York date and time), for a Service priced by area the `area` in sq ft (null follows the Property's floor area, else the rough `area` the Client asked with; `areaFrom` on the Office's Quote says which), and **overrides**, by the option's Service key: a price before tax, which needs a reason and has no lower bound. Every save prices the Draft afresh from the current Services and Price List and the Property's current details.
- **Offering a Service Plan unprompted**. `POST /api/quotes` with `{ propertyId, kind: "service_plan" }` (Office Staff) starts a Quote of its own, a Draft with its first Revision, or returns the Office's Draft one; refused while the Property has a Service Plan Quote, or a Requested one, open.
- **Sending**. `POST /api/quotes/:id/send` sends the Draft Revision exactly as last saved, making it the offer. It needs a proposed time still to come, the Client's email, Site Visit findings recorded where its Service needs them (ADR-0018; `needsSiteVisit` on the Office's Quote says so), and for a Service priced by area, an area (400 on `area`), which sending fixes on the Revision. Sending on an Expired Quote revives it, unless a newer open Quote of its kind exists for the Property. It emails the Client a plain link to `/portal/quotes/:id` (the Quote, never a Revision), with no sign-in power (ADR-0006); a later Revision's email says the Quote has been updated. Its options keep the whole Suggested Price breakdown they used, so Price List changes never touch it.
- **Turning Down**. `POST /api/quotes/:id/turn-down` with `{ reason }` (`out_of_area`, `out_of_scope` or `no_capacity`) closes a Quote before any Revision is Sent, and emails the Client why, with a link to the Quote (unless they have no email). After a Revision is Sent only the Client's Decline or Expiry closes it (409). It's final: the Client asks again for a new Quote.
- **Expiry** is at the end of the offer's validity or at its proposed time, whichever is first, read from the Clock (`statusOf` in `quote-state.ts`). Nothing runs to expire a Quote: `expired` is only written when a newer Quote of its kind is started for the Property.
- **Office Staff see every Revision** (`revisions` on `GET /api/quotes/:id`, newest first), the Draft being written (`draft`) and the offer (`offer`).
- **Clients see only the offer** (ADR-0017). `GET /api/quotes/mine` is their own Quotes, newest first: those they asked for (by phone too) and any the Office offered unprompted once Sent; a Draft is `requested` to them. `GET /api/quotes/mine/:id` is a `ClientQuoteView`: the latest Sent Revision (`QuoteView`, with `updatedAt` when it replaced an earlier one), or with nothing Sent, what they asked (`AskedQuoteView`, Requested or Turned Down, with any booked Site Visit). Never a Draft, the Office's Suggested Price or override reasons. `POST /mine/:id/decline` declines the offer; only a Sent Quote can be Declined.

## Accepting a Quote

Payment follows ADR-0001 and ADR-0008, and goes through the Payment Gateway (`#services/payment-gateway`, ADR-0004), with Stripe behind it (`stripe.ts`). Nothing outside that file knows it's Stripe, apart from the web app's payment form: ids are opaque strings, and webhooks arrive as our own `PaymentEvent`s. Every call that moves money carries an idempotency key, and the Stripe API version is pinned.

- **Payers and Payment Methods** (`#features/payments`). Each Client is one payer at the provider (a Stripe Customer), made the first time they pay or save a card (`payers`). A Client has one Payment Method (`payment_methods`): its id, a label such as "Visa ending 4242", and when they consented to later Charges (saving it, beside the consent wording). `GET /api/payment-methods/mine` is what's saved, or null; `GET /api/payment-methods/form` is which payment form the browser shows (Stripe's adds its publishable key).
- **Accepting**. `POST /api/quotes/mine/:id/accept` with `{ serviceKey, paymentToken? }` (a Service Plan Quote needs no `serviceKey`: it's accepted whole): the Client pays the Deposit on-session, with a card entered just now (the token from the browser's payment form; the same payment saves it as their Payment Method) or else their saved one. Only a Sent Quote that hasn't Expired can be Accepted. In one transaction it locks the Property and the day (`lockDay`, so two acceptances can't both take a day's last hours), checks the day has room, takes the Deposit (a 0% one only saves a card entered now), books the Job and marks the Quote Accepted. If the day has no room nothing is taken; if the Deposit is declined nothing is booked or saved; either way it's a 409 with a message to show, and the Quote stays Sent. A Deposit taken when the booking then fails to save is refunded. It answers `{ status: "accepted", quote }`, or `{ status: "needs_approval", secret }` when the Client's bank wants them to approve it (3D Secure): nothing is booked yet, and the payment waits in `pending_deposits`.
- **Finishing an approved Deposit**. After the browser runs the bank's approval with `secret`, `POST /api/quotes/mine/:id/accept/finalize` books it the same way (`finalizeDeposit`), or says why not: still waiting, refused, or the Quote closed or its day filled meanwhile (then the Deposit is refunded). The provider's webhook does the same, in case the browser never comes back; whichever is first books it, and the other finds it settled.
- **When the day fills up**. While drafting, the Office sees whether the proposed day has room for each Service (a warning only: the web app reads `GET /api/schedule` for the day). A Sent Quote doesn't hold its time, so another booking (or fewer Cleaner hours) can leave its day without room. Every Quote view says which Services can still be booked, by key (`bookable`, checked live; none once the Quote isn't Sent), so the portal offers only those and shows a plain message in place of the payment form when there are none. Such a Quote is under Needs attention as `quote_no_room` until a new Revision replaces the offer, and each booking emails every active Office Staff member about open Quotes for that day it has crowded out (`quote-room.ts`). Accepting still checks again, in case the day filled since the page loaded.
- **Recording acceptance on a Client's behalf**. `POST /api/quotes/:id/accept` with `{ serviceKey }` (Office Staff, e.g. by phone) charges the Client's saved Payment Method off-session; without one it's a 409 telling them to send the add-a-card link. A card whose bank wants approval can't be charged this way, and fails like a decline.
- **The webhook**. `POST /api/payments/webhook` reads the raw body, so it's mounted before `express.json()`. The gateway checks the signature (400 if it doesn't match) and turns the event into ours: `deposit_succeeded` finishes a pending Deposit; `charge_refunded` and `dispute_opened` are only logged until monitoring (#41). Locally, run `stripe listen --forward-to localhost:3000/api/payments/webhook` and put the signing secret it prints in `STRIPE_WEBHOOK_SECRET`.
- **The Stripe sandbox check**. `pnpm stripe:sandbox` runs the real adapter against the sandbox in `.env` (it refuses live keys) with Stripe's test cards: a Deposit that saves the card, an off-session Charge, idempotent refunds, a decline, 3D Secure asking for approval, a 0% Deposit, the save-only form and webhook signatures. It isn't part of `pnpm test`. The browser's part (the Payment Element, approving 3D Secure) can't run there.
- The Client is emailed a booking confirmation; if it can't go, the booking stands and the failure is logged.
- **The add-a-card link**. Office Staff never enter card details: `POST /api/payment-methods/requests` with `{ clientId }` emails the Client a plain link to `/portal/payment-method` (no sign-in power, ADR-0006). There the Client saves a card without paying: `POST /api/payment-methods/mine/card-form` starts a SetupIntent for the browser's form (`{ form, secret }`), and `PUT /api/payment-methods/mine` with the token it hands back keeps the card.
- **Charges** (`charges`) record each Deposit with its Job and the gateway's id, for refunds later.
- `GET /api/jobs/mine` is the Client's booked Jobs still to come, soonest first.
- **Reminders**. `sendDueReminders()` (`features/jobs/reminders.ts`) emails each Client whose Job is tomorrow in New York, from 8am today by the Clock, once. A Job booked the day before gets none (its confirmation has just gone). Each Job is claimed before its email and let go if the email fails, so it's safe to run often or on several servers. `src/index.ts` runs it every 10 minutes; tests call it directly (and the e2e control server's `POST /reminders`).

## Cancellation and No Access

`#features/cancellation`. Money moves through `settleJob` (`completion/balance.ts`), like everything else: a Cancelled or No Access Job owes its `fee_cents`, so settling refunds whatever it has paid beyond that.

- **What it costs** comes with the Job, by the Clock: `cancelTerms` on `GET /api/jobs/mine/:id` (the Client's, null once the Job has started) and on `GET /api/jobs/:id` (both sides, for the Office). More than 24 hours before the start it's free and the Deposit is refunded; from 24 hours it's a Late Cancellation and the Deposit is kept as the fee. Empire Cleaning cancelling is always free.
- **Cancelling**. `POST /api/jobs/mine/:id/cancel` (the Client) or `POST /api/jobs/:id/cancel` (Office Staff, with `by: "client" | "empire"` and an optional reason told to the Client). Each sends the `feeCents` the person was shown; if it's no longer what cancelling costs (the cut-off passed meanwhile), it's a 409 and nothing changes. The Job leaves the Schedule (`onSchedule`), its Assignments are kept for the record, and the Client and everyone holding a place are emailed; the Office too when the Client cancelled it themselves.
- **No Access**. `POST /api/assignments/mine/:id/no-access` with `{ reason }`, by a Cleaner with a Confirmed place once the Job has started (the rest of the crew needn't have Confirmed). It isn't Completed and keeps the Deposit as the fee; it stays on the Schedule. The Client and the Office are emailed.

## Reschedule Requests

`#features/reschedule`. A Client asks to move a booked Job to a new time; it keeps its time until Office Staff confirm (ADR-0010 for what it costs).

- **The times on offer**. `GET /api/jobs/mine/:id/reschedule-times` (and the Office's `/api/jobs/:id/reschedule-times`): the days from tomorrow, up to 8 weeks ahead, with room for the Job's Labour Hours (its own day always has room), each with the start times on offer (`START_TIMES`, on the hour from 8am to 4pm, plus the Job's own time of day) that have a crew free. A day with none is left out.
- **What it costs** comes with the Job, by the Clock: `rescheduleTerms` on `GET /api/jobs/mine/:id` and `GET /api/jobs/:id`, null once it can't be moved (not booked, started, or a request pending). 24 hours or more ahead it's `free`; less, it's a Late Reschedule: `free_late` if none has been confirmed for the Job yet, otherwise `late_cancellation`, with the Deposit as `feeCents` (0 if an earlier one kept it already).
- **Asking**. `POST /api/jobs/mine/:id/reschedule-request` (the Client) or `POST /api/jobs/:id/reschedule-request` (Office Staff, for them) with `{ date, time, cost }`, the cost the person was shown; if it's no longer what moving costs, it's a 409 and nothing is sent. It's judged then, not when it's answered. One pending request per Job. The Office is emailed when the Client asks.
- **The hold**. A pending request holds a crew at its new time, and its Labour Hours on a new day (`held` and `heldHours` in the Schedule, counted by `roomFor`), so asking locks that day (`lockDay`) like accepting a Quote. A move to another time on the Job's own day holds no hours. Holds count only while the Job is booked. Confirming checks the room again, without the request's own hold, as Cleaners' hours may have been cut since.
- **Answering**. `POST /api/jobs/:id/reschedule-request/confirm` moves the Job, clears its reminder so the new day gets one, and puts every Offered or Confirmed place back to Offered, emailing the Client and the crew. `.../turn-down` with an optional `reason` (told to the Client) and the Client's `POST /api/jobs/mine/:id/reschedule-request/withdraw` leave the Job as it was and cost nothing. Pending requests are under Needs attention as `reschedule_requested`, earliest asked first.
- **The fee**. Confirming a `late_cancellation` sets the Job's `reschedule_fee_cents` to the Deposit. Nothing is charged then: a Completed Job owes its price plus that fee (`settleJob`), so the full price is the Balance. A Client cancelling it later, early or late, keeps the fee and pays nothing more; Empire Cleaning cancelling still refunds everything.

## Site Visits

`#features/site-visits` (ADR-0015). A free visit by one Staff member to see a Property before it's quoted; never a Job, so no Quote, Deposit, Charges or Assignments. Business premises need one before any Quote is Sent (ADR-0014); a home may have one.

- **Booking** (Office Staff). `POST /api/site-visits` with `{ quoteId, staffId, date, time, minutes }`, for a Quote with no Revision Sent yet (ADR-0017), (30 minutes unless set, in quarter hours) books it at the Quote's Property for that Staff member, with no Offer or Confirm. It holds the day (`lockDay`) and checks: by a Cleaner with Available Hours that day, the day's hours and a Cleaner free then, as for a one-person Job; a Cleaner without hours that day who isn't Office Staff is refused; by anyone, no overlap with their other Site Visits. A Property has one booked at a time (a partial unique index).
- **Moving and cancelling**. `POST /api/site-visits/:id/move` with the same fields (it isn't counted against itself), and `POST /api/site-visits/:id/cancel`. The Client is emailed when one is booked, moved or cancelled, unless they have no email; they ask for changes by phone, so there's no portal action.
- **Findings**. `POST /api/site-visits/:id/findings` records what a booked visit found on the Property, and it's Done: business premises' Premises Type, floor area and Condition, or a home's rooms and Condition, either with the Office's notes (`officeNotes`, never shown to the Client; left out, they're kept). `POST /api/properties/:id/findings` records them with no visit, for premises the Office knows (a Done visit with no time or visitor); with one booked, they're recorded there instead (409). `PATCH /api/properties/:id` can correct the notes too.
- **Where it stands**. While a Quote has no Revision Sent and its Property has no findings, its `siteVisit` is `needed` (business premises with none booked) or `booked`; otherwise null. The Property's page lists its visits and `findingsRecorded`.
- **Their own**. `GET /api/site-visits/mine` is a Client's booked visits from today on; `GET /api/site-visits/visiting` a Cleaner's, today's and those to come.
