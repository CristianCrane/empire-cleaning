// Startup's monitoring setup, loaded before anything else (`--import` in
// package.json's start), so Sentry can trace Express, Postgres and outgoing
// calls. The only place outside its adapter that touches Sentry (ADR-0007).
// Without SENTRY_DSN (dev, tests) nothing is sent and errors are only logged.
import { log, setReporter } from "#services/monitoring";
import { sentryReporter, startSentry } from "./services/monitoring/sentry.ts";
import env from "./env.ts";

if (env.SENTRY_DSN) {
  startSentry({
    dsn: env.SENTRY_DSN,
    environment: env.APP_MODE,
    release: env.RENDER_GIT_COMMIT,
  });
  setReporter(sentryReporter);
} else {
  log.info("no SENTRY_DSN: errors are only logged");
}
