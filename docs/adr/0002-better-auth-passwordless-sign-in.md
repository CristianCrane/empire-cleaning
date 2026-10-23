# Better Auth with passwordless sign-in on our own Postgres

Accounts are handled by Better Auth, an open-source library storing its data in our own Postgres, with sign-in by emailed one-time link or Google. We chose it over building email and password ourselves (Clients sign in rarely and forget passwords), and over hosted providers such as Clerk or Auth0 (per-user fees and lock-in for data we'd rather own). Passwordless links fit our "least Client friction" goal: a Client's Account is created with their first Quote Request, and every Quote email carries a link that signs them in straight to that Quote, so accepting needs no separate login step.

## Consequences

- Sending email becomes a core dependency from the first Quote Request onward.
- A future native Cleaner app must be able to authenticate against the same Accounts, so sign-in must not depend on browser cookies alone.
