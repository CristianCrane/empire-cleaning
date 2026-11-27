# Server

Import a feature by `#features/<feature>` (its `index.ts`), never a path inside it (#112).

## Setup

Copy `.env.example` to `.env` and fill it in: the server won't start without what it needs, and `pnpm env:check` checks without starting it. `pnpm db:generate` needs nothing set; `db:migrate`, `db:push` and `db:studio` need only `DB_URL` (#389).

After `pnpm db:migrate`, make the first Office Staff member, then sign up with that email:

```sh
pnpm auth:create-owner owner@example.com "Owner Name"
```

Or seed a dev database: `pnpm db:seed` (the owner is `SEED_OWNER_EMAIL`); `--reset` first deletes all but Accounts, the Price List and the Services; `SEED_NOW` (an ISO instant) seeds as if it were then. `pnpm staff:testers` adds the testers in `tests/testers.ts`.

**Renaming a table or column:** `pnpm db:generate` asks whether each is a rename, and drizzle-kit has no flag that answers ([its docs](https://orm.drizzle.team/docs/drizzle-kit-generate)) until drizzle-team/drizzle-orm#5307. Drive the prompt through `script -qfc` with arrow-down and Enter, then add a `RENAME CONSTRAINT` by hand for each constraint name it keeps, as `drizzle/20261106163449_cleaner_needed_tables` does.

**A migration that reads rows back from their words** matches every wording the code ever wrote (`git log -p -G'<column or phrase>'`). A row matching none raises (`RAISE EXCEPTION`), so the deploy stops, rather than falling to an `ELSE`, unless any text is a right value there. Try it on sample rows of each wording in a scratch database first.

**A one-off Node script** that imports `pg` or `#db` goes under `packages/server/`, where those resolve; run it with `node --env-file=.env` or `npx tsx --env-file=.env`, and delete it after.

## Testing

Each test run claims database names of its own, `empire_test_r<run>_<n>`, and the next claim drops a dead run's. Each e2e run leases a block of 200 ports, `E2E_PORTS` (`tests/ports.ts`), so runs go at once and nobody picks one. `docker restart empire_postgres_test` clears every test database and ends every run going on.

Every checkout shares the one test Postgres. Signs it's time for one per checkout:

- **It runs out of connections:** `docker logs empire_postgres_test 2>&1 | grep -c "too many clients"` is above 0, or the peak during runs passes about 200 (`docker exec empire_postgres_test psql -U postgres -tAc "select count(*) from pg_stat_activity"`; a full suite alone peaks at 67).
- **Its CPU is pinned** (`docker stats empire_postgres_test`) while the machine has room.
- **A branch needs a different Postgres** while other checkouts need this one.

Two signs are bugs to fix, not reasons to switch: another run's error reaching yours (`terminating connection due to administrator command`, `is being accessed by other users`: a name is still shared), and leftover databases piling up (`docker exec empire_postgres_test psql -U postgres -tAc "select count(*) from pg_database"` in the hundreds; restart once no run is going).

The test seams are in `tests/harness.ts`: `api()` (`apiAgent()` keeps cookies), `testClock()`, `testPayments()`, `testEmail()`, `testMonitoring()`, and `signIn(email)`, once the Staff or Client record is added. A worker's files share one loaded server (`isolate: false`); to check that files and tests don't lean on each other: `pnpm vitest run --sequence.shuffle.files --sequence.shuffle.tests`.

`pnpm stripe:sandbox` runs the real payment adapter against the Stripe sandbox in `.env` (it refuses live keys); `pnpm test` doesn't. The browser's part is the web app's sandbox run (`packages/web/README.md`).

## Monitoring

Only `#services/monitoring` talks to Sentry (ADR-0007), besides its startup, `src/instrument.ts`, which `pnpm start` loads with `--import`. Logs are its `log`; `LOG_LEVEL` sets how much. Every database pool is built by `poolOf` (`src/db/pool.ts`).

To add a signal: put it in `SIGNALS` (`services/monitoring/signals.ts`) with its urgency and what it means, raise it where it happens, test it with `testMonitoring().signalled(name)` (`counted(name)` for a counted one), and add it to ADR-0007's table and, if it's alerted, to Sentry's alert rules (#43).

## Emails

An email is a builder in its feature's `emails.ts`: `services/email/blocks.ts`'s header says how one is written and sent, and ADR-0025 its language.

`pnpm email:dev` (from the repo root) previews every file in `emails/` on http://localhost:3002, with sample data from `emails/samples.ts`; `EMAIL_LANG=es` shows them in Spanish. It reloads on `emails/` only, so restart it after changing a builder or the layout.
