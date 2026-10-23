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
