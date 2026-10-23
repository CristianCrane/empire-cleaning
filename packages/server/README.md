# Express server starter


## Testing

`pnpm test` runs the suite against a dedicated `empire_test` database (override with `TEST_DB_URL`), which is dropped, recreated and migrated from `drizzle/` on every run. Postgres must be up (`pnpm db:up`).

Tests exercise external behaviour through the seams in `tests/harness.ts`:

- `api()` drives the real Express app over HTTP via supertest (`apiAgent()` keeps cookies between requests)
- `testClock()` controls the time read through `#services/clock`
- `testPayments()` is a fake Payment Gateway that records Charges and refunds and can be told to decline (`failCharges()`)
- `testEmail()` captures every email sent through `#services/email`

Fakes are fresh and every table is truncated before each test.
