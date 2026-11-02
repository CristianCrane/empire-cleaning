import * as Sentry from "@sentry/node";
import type { ErrorEvent } from "@sentry/node";
import { currentRequestId } from "./log.ts";
import { scrub } from "@empire-cleaning/models";
import type { Reporter } from "./index.ts";

// the scheduler's one cron monitor (ADR-0007), created on its first check-in.
// It ticks every 10 minutes (src/scheduler.ts); a tick may take a while
const HEARTBEAT = "scheduler";
const HEARTBEAT_MONITOR = {
  schedule: { type: "interval", value: 10, unit: "minute" },
  checkinMargin: 5,
  maxRuntime: 10,
} as const;

export const startSentry = ({
  dsn,
  environment,
  release,
}: {
  dsn: string;
  environment: string;
  release: string | undefined;
}) => {
  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: 0.2,
    // nothing about the person, and no cookies, bodies, headers or queries;
    // what's left is scrubbed before it's sent
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { allow: ["user-agent"] },
      httpBodies: [],
      urlQueryParams: false,
    },
    // unhandled errors are reported through `monitoring.error` (src/index.ts),
    // like every other error
    integrations: (defaults) =>
      defaults.filter(
        ({ name }) =>
          name !== "OnUncaughtException" && name !== "OnUnhandledRejection",
      ),
    beforeSend: (event) => scrubEvent(event),
    // spans are streamed as they end, so are scrubbed one by one
    beforeSendSpan: (span) => scrub(span),
    beforeBreadcrumb: (breadcrumb) => scrub(breadcrumb),
  });
};

export const sentryReporter: Reporter = {
  error: (error, context) => {
    Sentry.captureException(error, {
      tags: requestTags(),
      extra: context,
    });
  },
  signal: (name, urgency, context) => {
    Sentry.captureMessage(name, {
      level: urgency === "counted" ? "info" : "warning",
      tags: { ...requestTags(), signal: name, urgency },
      extra: context,
      // one issue per signal, however its context varies
      fingerprint: ["signal", name],
    });
  },
  heartbeat: () => {
    Sentry.captureCheckIn(
      { monitorSlug: HEARTBEAT, status: "ok" },
      HEARTBEAT_MONITOR,
    );
  },
};

// waits for queued events to be sent, before the process exits
export const flushSentry = () => Sentry.flush(2000);

const requestTags = () => {
  const requestId = currentRequestId();
  return requestId ? { request_id: requestId } : {};
};

// the request's body, cookies, query and headers (other than which browser)
// never leave; nor does anything about the person but their ID
const scrubEvent = (event: ErrorEvent): ErrorEvent => {
  if (event.request) {
    const userAgent = event.request.headers?.["user-agent"];
    event.request = {
      method: event.request.method,
      url: event.request.url,
      ...(userAgent ? { headers: { "user-agent": userAgent } } : {}),
    };
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  return scrub(event);
};
