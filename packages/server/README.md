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

Better Auth (ADR-0002) is mounted at `/api/auth/*`; sign-in is by emailed one-time link or Google, never a password. Signing in never creates an Account: our own flows do (Quote Request, Staff invite, and the owner setup below). `GET /api/me` returns the signed-in Account.

Protect an endpoint with `authorize()` from `#features/auth`: `authorize()` allows any signed-in Account, `authorize("office_staff")` only Accounts holding that role (401 for Guests, 403 for the wrong role). Inside the handler, `signedInAccount(res)` returns the caller.

Create the first Office Staff Account (after `pnpm db:migrate`):

```sh
pnpm auth:create-owner owner@example.com "Owner Name"
```

In prod the server refuses to start without `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY`. `BETTER_AUTH_URL` is this API's public URL (sign-in links point at it).

In tests, `signIn(email)` from `tests/harness.ts` returns a signed-in agent.
