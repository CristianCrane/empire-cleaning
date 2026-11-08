import * as Sentry from "@sentry/react";
import type { Breadcrumb, Event } from "@sentry/react";
import { scrub, scrubText } from "@empire-cleaning/models";

// Sentry in the browser (ADR-0007): the web app and the landing site's Quote
// form each start it once, and only here is it set up. Without a DSN (dev,
// tests) it never starts and nothing is sent.

type Integration = Parameters<typeof Sentry.addIntegration>[0];

export type MonitoringOptions = {
  // the browser project's address in Sentry, set at build time
  dsn: string | undefined;
  // dev, test or prod, as the server names it
  environment: string;
  // where the API is, when not this page's own origin: page loads are linked
  // to the API's traces by headers sent only there
  apiUrl?: string;
  // how page loads and page changes are traced: by the app's router, or
  // else as plain page loads
  tracing?: Integration;
  // Sentry's feedback button on every page (the test site's, ADR-0020)
  feedback?: boolean;
};

// set at build from the git commit (./vite.ts), the same release as the
// server's
declare const __RELEASE__: string | null;

export const startMonitoring = ({
  dsn,
  environment,
  apiUrl,
  tracing,
  feedback = false,
}: MonitoringOptions) => {
  if (!dsn || Sentry.isInitialized()) return;
  Sentry.init({
    dsn,
    environment,
    release: __RELEASE__ ?? undefined,
    // no session replay: it records what people type and see
    integrations: [
      tracing ?? Sentry.browserTracingIntegration(),
      ...(feedback ? [feedbackButton()] : []),
    ],
    tracesSampleRate: 0.2,
    tracePropagationTargets: apiUrl ? [apiUrl] : [/^\/api\//],
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { allow: ["user-agent"] },
      httpBodies: [],
      urlQueryParams: false,
    },
    // the connection dropping, which says nothing about our code; the API
    // being down is caught by its own uptime check
    ignoreErrors: [
      "Failed to fetch",
      "NetworkError when attempting to fetch resource.",
      "Load failed",
    ],
    beforeSendSpan: (span) => scrub(span),
    beforeBreadcrumb: scrubBreadcrumb,
  });
  // every event, scrubbed last: an error's, a report's from the feedback
  // button (which `beforeSend` never sees: it's only for errors), and any
  // other kind
  Sentry.addEventProcessor(scrubEvent);
};

// a floating button opening a form: what they noticed, and a screenshot if
// they like. They're known by the Account ID alone, so no name or email is
// asked. Placed and coloured by the app (packages/web/src/feedback.css)
const feedbackButton = () =>
  Sentry.feedbackIntegration({
    showBranding: false,
    showName: false,
    showEmail: false,
    enableScreenshot: true,
    triggerLabel: "Send feedback",
    formTitle: "Send feedback",
    messageLabel: "What did you notice?",
    messagePlaceholder: "Something that's wrong, or that you'd change",
    submitButtonLabel: "Send",
    successMessageText: "Thanks! We got it.",
  });

// who's signed in, by Account ID only; none when signed out
export const identify = (accountId: string | undefined) => {
  Sentry.setUser(accountId ? { id: accountId } : null);
};

// an error the app caught but didn't expect
export const report = (error: unknown) => {
  Sentry.captureException(error);
};

// page loads and page changes traced by TanStack Router's routes, named
// after them (/portal/jobs/$jobId), for `tracing`
export const routerTracing = (router: unknown) =>
  Sentry.tanstackRouterBrowserTracingIntegration(router);

// what may leave of an event: the page's address and browser, the Account ID,
// and the rest scrubbed. Its breadcrumbs were scrubbed as they were left
export const scrubEvent = ({
  request,
  user,
  breadcrumbs,
  ...event
}: Event): Event => ({
  ...scrub(event),
  ...(breadcrumbs ? { breadcrumbs } : {}),
  ...(request
    ? {
        request: {
          ...(request.url ? { url: scrubText(request.url) } : {}),
          ...(request.headers?.["User-Agent"]
            ? { headers: { "User-Agent": request.headers["User-Agent"] } }
            : {}),
        },
      }
    : {}),
  ...(user?.id ? { user: { id: user.id } } : {}),
});

// a page change keeps where from and to (IDs only, its query scrubbed), and
// console lines are dropped: anything could be logged, form values included.
// Every other crumb is scrubbed whole
export const scrubBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb | null =>
  breadcrumb.category === "console"
    ? null
    : breadcrumb.category === "navigation"
      ? {
          ...breadcrumb,
          data: {
            from: scrubText(String(breadcrumb.data?.from ?? "")),
            to: scrubText(String(breadcrumb.data?.to ?? "")),
          },
        }
      : scrub(breadcrumb);
