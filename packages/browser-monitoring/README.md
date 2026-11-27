# Browser monitoring

Sentry in the browser (ADR-0007), the one place the web app and landing site set it up; the server has its own (`#services/monitoring`).

In a site:

- `startMonitoring({ dsn, environment, apiUrl?, tracing?, feedback? })`: with no DSN, nothing is sent.
- `tracing: routerTracing(router)`.
- `feedback: feedbackButton(look)`, from `@empire-cleaning/browser-monitoring/feedback`, on the test sites only; `look` is `@empire-cleaning/ui/feedback.css` as `?inline` text.
- `identify(accountId)`.
- `report(error)`: an error caught but not expected (the web app's `reportUnexpected` decides).

In its Vite plugins: `monitoringBuild(project)` from `@empire-cleaning/browser-monitoring/vite`; with `SENTRY_AUTH_TOKEN` and `SENTRY_ORG`, its source maps go to `project` and are never published.

## Testing

What may reach Sentry is ADR-0007's (Client data and logs). `scrubEvent` in `src/index.ts` scrubs every event last, and `src/index.test.ts` holds every case: a change to what's sent changes that test.

```sh
pnpm --filter @empire-cleaning/browser-monitoring test
```

The feedback button in a real browser: `packages/web/src/feedback.test.tsx` (`pnpm --filter @empire-cleaning/web exec vitest run`).
