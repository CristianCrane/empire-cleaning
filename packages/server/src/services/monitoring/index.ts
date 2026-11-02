import { log } from "./log.ts";
import { scrub } from "@empire-cleaning/models";
import { urgencyOf, type Signal, type Urgency } from "./signals.ts";

// IDs and short facts about what was happening: Client, Staff and Account IDs,
// never their details (ADR-0007). Scrubbed anyway, in case
export type Context = Record<string, string | number | boolean | null>;

// where reports go beyond the logs: Sentry (sentry.ts, installed at startup
// when there are keys), nowhere (dev without keys), or a fake in tests
export interface Reporter {
  error(error: unknown, context: Context): void;
  signal(name: Signal, urgency: Urgency, context: Context): void;
  heartbeat(): void;
}

export const consoleOnly: Reporter = {
  error: () => {},
  signal: () => {},
  heartbeat: () => {},
};

// a failure already raised as a signal (e.g. an email the service refused):
// `monitoring.error` only logs it, so it isn't reported twice
export class SignalledError extends Error {
  readonly signal: Signal;

  constructor(signal: Signal, message: string, options?: ErrorOptions) {
    super(message, options);
    this.signal = signal;
    this.name = "SignalledError";
  }
}

let current: Reporter = consoleOnly;

// The one way the server reports (ADR-0007). Everything is logged; errors,
// signals and heartbeats also go to the Reporter.
export const monitoring = {
  // 5xx responses, unhandled errors, and failures caught but not expected.
  // Never 4xx: those are normal business
  error: (error: unknown, context: Context = {}) => {
    if (error instanceof SignalledError) {
      log.warn({ err: error, ...context }, error.message);
      return;
    }
    log.error({ err: error, ...context }, messageOf(error));
    current.error(error, scrub(context));
  },
  signal: (name: Signal, context: Context = {}) => {
    const urgency = urgencyOf(name);
    log.warn({ signal: name, urgency, ...context }, name);
    current.signal(name, urgency, scrub(context));
  },
  // the scheduler ran every due job; Sentry's cron monitor alerts when these
  // stop
  heartbeat: () => {
    current.heartbeat();
  },
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// startup installs Sentry, and tests a fake
export const setReporter = (next: Reporter) => {
  current = next;
};

export { log, withRequest, currentRequestId } from "./log.ts";
export { scrubText } from "@empire-cleaning/models";
export { SIGNALS, type Signal, type Urgency } from "./signals.ts";
