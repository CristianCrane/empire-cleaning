# Browser monitoring

Sentry in the browser (ADR-0007), for the web app and the landing site's Quote form, and the only place either sets it up. The server has its own (`packages/server`, `#services/monitoring`); both scrub with the same rules (`scrub` in `@empire-cleaning/models`).

- **`startMonitoring({ dsn, environment, apiUrl?, tracing?, feedback? })`** starts Sentry once. Without a DSN it doesn't, and nothing is sent: dev and test builds have none. About 20% of page loads are traced, with headers linking them to the API's traces sent only to the API (this page's own `/api`, or `apiUrl`); `tracing` is the router's, so page changes are traced and named after their routes (`routerTracing(router)`). `feedback` is `feedbackButton()`, Sentry's feedback button on every page (the web app's test site only, ADR-0020), passed in like `tracing` so a build that doesn't pass it leaves its code out: a form asking what they noticed, with a screenshot on a computer (Sentry offers none on a phone or tablet), and no name or email. The app places and colours it (`packages/web/src/feedback.css`).
- **`identify(accountId)`**: who's signed in, by Account ID only.
- **`report(error)`**: an error the app caught but didn't expect. Errors nothing caught are reported by Sentry itself.
- **`monitoringBuild(project)`** (`@empire-cleaning/browser-monitoring/vite`), in the app's Vite plugins: the release is the git commit Render builds (`RENDER_GIT_COMMIT`), the same as the server's. With `SENTRY_AUTH_TOKEN` and `SENTRY_ORG`, the build makes source maps, uploads them to `project` and deletes them, so stack traces read as the source but no map is published.

## What may be sent

- the error, its stack, and the breadcrumbs leading to it: clicks (the element, never what was typed), page changes and calls to the API (method, path, status)
- the page's address and the browser
- the Account ID of whoever is signed in
- on the test site, a report from the feedback button: what they typed, and a screenshot of the page if they add one

## What mustn't

- no session replay, which records what people type and see (a report's screenshot is one picture, taken and sent only when the tester chooses, and only on the test site, which holds no real Client's details)
- no form values, request or response bodies, cookies or headers but the browser's
- no emails, phone numbers or URL query values (a sign-in link's token) anywhere in an event, and no keys such as `email`, `phone`, `address` or `accessInstructions` (`scrub`)
- no console lines, which could hold anything
- no user details but the Account ID

Every event, of every kind, is scrubbed last by one event processor (`scrubEvent`): Sentry's `beforeSend` sees only errors, so a feedback report would pass it by. `src/index.test.ts` covers the scrubbing, and `pnpm --filter @empire-cleaning/browser-monitoring test` runs it. The feedback button is checked in a real browser with the web app's layout, by `packages/web/src/feedback.test.tsx` (`pnpm --filter @empire-cleaning/web exec vitest run`).
