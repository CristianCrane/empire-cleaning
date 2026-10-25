# Express server starter

## Testing

`pnpm test` runs the suite against a dedicated `empire_test` database on the **test Postgres** (`docker-compose.yml`, port 5433; override with `TEST_DB_URL`), which is dropped, recreated and migrated from `drizzle/` on every run. Start it with `pnpm db:up`.

The test Postgres lives in memory with disk syncing off. Committing to disk took tens of milliseconds a time on a Docker volume (47 ms measured), and a test run makes thousands of commits. Test data is disposable, so nothing is lost. Never put real data there.

Tests exercise external behaviour through the seams in `tests/harness.ts`:

- `api()` drives the real Express app over HTTP via supertest (`apiAgent()` keeps cookies between requests)
- `testClock()` controls the time read through `#services/clock`
- `testPayments()` is a fake Payment Gateway that records Charges and refunds and can be told to decline (`failCharges()`)
- `testEmail()` captures every email sent through `#services/email`

Fakes are fresh and every table is emptied before each test, with one `DELETE` transaction (`resetDatabase`). Not `TRUNCATE`: that creates and syncs fresh files for every table and index, which took about 4 s per test here and more with every table added.

Test files share one loaded copy of the server (`isolate: false`), because loading it takes about 5 s. That is safe because files run one at a time and every test starts clean (`tests/setup/perTest.ts`); running them in random order (`pnpm vitest run --sequence.shuffle.files --sequence.shuffle.tests`) is a way to check.

## Accounts and sign-in

Better Auth (ADR-0002) is mounted at `/api/auth/*`; signing up and in are by emailed one-time link or Google, never a password. `GET /api/me` returns the signed-in Account.

Accounts come only from signing up, so an Account's email is always proven (ADR-0006). Clients (`#features/clients`, created by Quote Requests) and Staff (`#features/staff`, created by invitation or the owner setup below) are separate records. An Account is connected to the records whose email matches its own, at sign-up, at every later sign-in, and straight away when a record is added for an email that has already signed up. A connection is stored once made, so it survives either email changing. An Account connected to nothing has no roles.

Protect an endpoint with `authorize()` from `#features/auth`. Roles come from the caller's connections: the roles of an active Staff member, plus `client` for a connected Client.

- `authorize()` allows any signed-in Account, even one connected to nothing.
- `authorize("office_staff")` allows only Accounts holding that role. Guests get a 401, and the wrong role gets a 403.

Inside the handler, `signedInAccount(res)` returns the caller.

Create the first Office Staff member (after `pnpm db:migrate`), then sign up with that email:

```sh
pnpm auth:create-owner owner@example.com "Owner Name"
```

The server refuses to start, in dev and prod alike, without `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` and `CORS_ORIGIN_URL` (the web app's address): copy `.env.example` to `.env` and fill them in. `BETTER_AUTH_URL` is this API's public URL (sign-in links point at it). Tests supply fake values and fake the services behind them.

In tests, `signIn(email)` from `tests/harness.ts` signs up or in the way a person does and returns a signed-in agent; add the Staff or Client record first for it to connect to.

## Quote Requests

`POST /api/quote-requests` is open to Guests (the landing site) and signed-in Accounts (the portal). It creates the Client and Property as needed, but never an Account (ADR-0006):

- **A Guest** sends contact details. If a Client already has that email, the request is added to that Client and their details are left as they are.
- **An Account connected to no Client** sends a name and phone, and becomes a new Client with its proven email, connected straight away.
- **A Client** sends neither: just a new home or one of their own.

- **One address is one home** per Client. Addresses are compared after normalising capitals, punctuation, spacing and common abbreviations (`features/properties/address.ts`), so "41-12 Austin Street, Apt 4B" is "41 12 austin st #4b". A different unit is a different home. Entering a known address again uses that home with the details it was first given, and only restates its Condition.
- **One request waiting per home.** A second request for a home that already has one is refused with a 409 and a plain message. Until Quotes and Turning Down exist (#5, #6), every request is waiting.
- **The receipt** goes to the Client's own address, with no sign-in link. If it can't be sent, the request is still saved and the failure is logged.

Validation messages are written to be shown beside the form's fields.

- `GET /api/quote-requests` (Office Staff) lists them.
- `GET` and `PATCH /api/clients/me` are a Client's own record and contact details.
- `GET /api/clients/:id` (Office Staff) is any Client.
- `PATCH /api/properties/:id/access-instructions` is open to the Client or Office Staff.
- `PATCH /api/properties/:id` (Office Staff only) corrects a home's details: type, bedrooms, bathrooms, floors, pets, floor area and Condition. Its address is its identity and isn't correctable.

## Price List and Suggested Price

The Price List (`#features/price-list`) holds every figure Suggested Prices come from. Money is in cents, before tax. **Every save is a new version**, never an edit, so a Quote can point at the exact version it used; the current one is the latest. The first read creates version 1 from placeholder figures (`placeholder: true`) until Office Staff save their own.

- `GET` and `PUT /api/price-list` (Office Staff) read and save it. A save sends the whole list.
- `GET /api/price-list/add-ons` is open to everyone: the names of the Add-ons on offer, never prices (the landing page's form lists them).
- **Add-ons are never deleted.** Leaving one out of a save retires it, with the same key, so requests that chose it still price it.
- `GET /api/quote-requests/:id` (Office Staff) returns a request in full with its Suggested Price for both Clean Types, worked out now from the current Price List and the home's current details and Condition.

The calculation (`suggested-price.ts`):

```text
home hours   = base + bedrooms + bathrooms + (floors - 1) + pets
Labour Hours = home hours x Condition x Clean Type, plus each Add-on's own hours
               (not multiplied), rounded UP to the quarter-hour
price        = Labour Hours x hourly rate, to the whole dollar, at least the Minimum Charge
tax          = the one-off Jobs rate on the price, less tax-exempt Add-ons' share
```

It uses whole numbers throughout (hours in 1e-4, multipliers in hundredths), so a quarter-hour boundary is never missed by floating point: 3 x 0.4 h + 0.55 h is exactly 1.75 h, though it is 1.7500000000000002 as decimals.

## Staff, availability and the Schedule

Everything here is for Office Staff. Days are Empire Cleaning's own, in New York (`#services/clock`: `dayOf`, `startOfDay`), written `2026-11-03`: a Job at 9pm on the 3rd is on the 3rd, though it is the 4th in UTC.

- `GET /api/staff` lists everyone ever invited, active first. Each has an `imageUrl`: their Google profile picture, refreshed at every Google sign-in (`overrideUserInfoOnSignIn`), or null until they've used Google. `POST /api/staff` invites someone by name, email and roles. It creates a Staff record, never an Account (ADR-0006), and emails a link to the sign-in page; the email itself grants nothing. Inviting a deactivated member again brings them back with the roles given now; inviting an active one is a 409.
- `POST /api/staff/:id/deactivate` ends their Staff access at once and leaves their Account and any Client untouched. The last active Office Staff member can't be deactivated (409).
- `GET /api/staff/:id` includes their availability: a **usual week** (hours per weekday, Monday first; `PUT /api/staff/:id/usual-week`) and **exceptions** for single days, which replace that day's usual hours (`PUT` and `DELETE /api/staff/:id/exceptions/:date`). Hours are in quarter-hours.
- `GET /api/schedule?from=&to=` returns each day of the range (at most 62): its booked Jobs, the Staff hours available, the Labour Hours booked and the difference. **Only active Cleaners' hours count**, as Labour Hours are cleaning time.
- `GET /api/schedule/capacity?date=&labourHours=` says whether a day's free hours cover a booking. Accepting a Quote (#8) will call `hasRoomFor()` directly.

Jobs (`#features/jobs`) hold only what the Schedule needs so far: Property, Clean Type, start, Labour Hours, Crew Size and a `booked` status. Nothing in the API books one until #8, so tests use `bookedJob()` from `tests/fixtures.ts` (and the e2e control server's `POST /jobs`).
