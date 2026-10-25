# Express server starter

## Testing

`pnpm test` runs the suite against a dedicated `empire_test` database (override with `TEST_DB_URL`), which is dropped, recreated and migrated from `drizzle/` on every run. Postgres must be up (`pnpm db:up`).

Tests exercise external behaviour through the seams in `tests/harness.ts`:

- `api()` drives the real Express app over HTTP via supertest (`apiAgent()` keeps cookies between requests)
- `testClock()` controls the time read through `#services/clock`
- `testPayments()` is a fake Payment Gateway that records Charges and refunds and can be told to decline (`failCharges()`)
- `testEmail()` captures every email sent through `#services/email`

Fakes are fresh and every table is truncated before each test.

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
