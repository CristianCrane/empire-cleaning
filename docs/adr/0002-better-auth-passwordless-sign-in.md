# Better Auth with passwordless sign-in on our own Postgres

Accounts are handled by Better Auth, an open-source library storing its data in our own Postgres, with sign-in by emailed one-time link or Google. We chose it over building email and password ourselves (Clients sign in rarely and forget passwords), and over hosted providers such as Clerk or Auth0 (per-user fees and lock-in for data we'd rather own). Passwordless sign-in fits our "least Client friction" goal: there is no password to forget.

## Consequences

- Superseded in part by ADR-0006: Accounts are created only by signing up (not with the Quote Request), and Quote emails link to the Quote without signing anyone in.
- Sending email is a core dependency: sign-in links and every notification go by email.
- A future native Cleaner app must be able to authenticate against the same Accounts, so sign-in must not depend on browser cookies alone.
