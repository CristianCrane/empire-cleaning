# Render hosts the API, database and both static sites

The server, its Postgres database, the web app and the landing site are all hosted on Render, described in the repo (`render.yaml`, and `render-production.yaml` since #461), with a test environment set up exactly as production is. Two things the code already depends on shaped the choice. The scheduled runs (reminders, Service Plan Jobs, weekly Bills, chasing) run inside the server process every 10 minutes, so the server must stay running: a host that sleeps it when idle would miss them. And the web app calls `/api` on its own origin, so the host must forward `/api` to the server. Render runs an always-on Node service, managed Postgres with backups, and static sites with a rewrite to the server, for about $13 a month per environment, deploying from GitHub.

We chose this over Railway (static sites each need a running process), Fly.io (its managed Postgres costs several times more, or a second vendor such as Neon) and one small VPS for both environments (cheapest, but backups, OS updates and the proxy would be ours to run, the same reason ADR-0007 rejected self-hosting monitoring). Vercel, which hosts the current site and the domain's DNS, would serve the static sites but not the always-on server.

## Consequences

- Production: the landing site at `www.empirecleaningandpro.com`, the web app at `app.empirecleaningandpro.com` with `/api` forwarded to the server; sign-in links, Stripe's webhook and the landing form all use `app…/api`. The test environment is the same at `test.` and `app.test.`. DNS stays on Vercel.
- The test environment deploys from `main` once CI passes; production is only ever released by hand. Migrations run on every deploy.
- Production is a Blueprint of its own, `render-production.yaml` (#461): Render syncs a Blueprint whenever a push changes its file, creating and deploying what changed, so production in `render.yaml` would be created and deployed by a merge. Its Blueprint has Auto Sync off and its services never auto-deploy. Render can't share settings between Blueprints (YAML anchors aren't supported, and environment groups hold no secrets, headers or routes), so a server test holds production to the test site but for the differences it lists.
- Each environment has its own Stripe sandbox, Google sign-in client, auth secret and Sentry environment; they share the Resend account.
- `APP_MODE=test` marks the test environment: a banner on every page, `[TEST]` on email subjects, no search indexing, emails only to allowed addresses (the rest go to the Office inbox), Office time controls that move the Clock forward, and Sentry's feedback widget.
- Running more than one server process would need #32's rate-limit counts kept outside memory.
