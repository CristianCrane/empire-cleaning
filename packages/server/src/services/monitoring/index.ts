import { log } from "./log.ts";
import { scrub } from "@empire-cleaning/models";
import { clock } from "#services/clock";
import { urgencyOf, windowOf, type Signal, type Urgency } from "./signals.ts";
import { unitOf, type Measure, type Unit } from "./measures.ts";

// IDs and short facts about what was happening: Client, Staff and Account IDs,
// never their details (ADR-0007). Scrubbed anyway, in case
export type Context = Record<string, string | number | boolean | null>;

// where reports go beyond the logs: Sentry (sentry.ts, installed at startup
// when there are keys), nowhere (dev without keys), or a fake in tests
export interface Reporter {
  error(error: unknown, context: Context): void;
  signal(name: Signal, urgency: Urgency, context: Context): void;
  measure(name: Measure, value: number, unit: Unit, context: Context): void;
  heartbeat(): void;
}

const consoleOnly: Reporter = {
  error: () => {},
  signal: () => {},
  measure: () => {},
  heartbeat: () => {},
};

// a failure already raised as a signal (e.g. an email the service refused):
// `monitoring.error` only logs it, or an error it caused (a query drizzle
// wrapped), so it isn't reported twice
export class SignalledError extends Error {
  readonly signal: Signal;

  constructor(signal: Signal, message: string, options?: ErrorOptions) {
    super(message, options);
    this.signal = signal;
    this.name = "SignalledError";
  }
}

let current: Reporter = consoleOnly;

// when each signal told at most once a window was last told, by its name and
// context
const toldAt = new Map<string, number>();

// whether `name` was told with this `context` within its window; if not, it
// counts as told now
const toldWithin = (name: Signal, context: Context) => {
  const window = windowOf(name);
  if (window === undefined) return false;
  const key = JSON.stringify([name, context]);
  const now = clock.now().getTime();
  const told = toldAt.get(key);
  if (told !== undefined && now - told < window) return true;
  toldAt.set(key, now);
  return false;
};

// The one way the server reports (ADR-0007). Errors and signals are logged
// and go to the Reporter; measures and heartbeats only go to it, as they come
// every few seconds or minutes.
export const monitoring = {
  // 5xx responses, unhandled errors, and failures caught but not expected.
  // Never 4xx: those are normal business
  error: (error: unknown, context: Context = {}) => {
    const signalled = signalledIn(error);
    if (signalled) {
      log.warn({ err: error, ...context }, signalled.message);
      return;
    }
    log.error({ err: error, ...context }, messageOf(error));
    current.error(error, scrub(context));
  },
  signal: (name: Signal, context: Context = {}) => {
    if (toldWithin(name, context)) return;
    const urgency = urgencyOf(name);
    log.warn({ signal: name, urgency, ...context }, name);
    current.signal(name, urgency, scrub(context));
  },
  // a sample of a measure, e.g. a pool's connections in use
  measure: (name: Measure, value: number, context: Context = {}) => {
    current.measure(name, value, unitOf(name), scrub(context));
  },
  // the scheduler ran every due job; Sentry's cron monitor alerts when these
  // stop
  heartbeat: () => {
    current.heartbeat();
  },
};

// the SignalledError that `error` is, or that caused it (once round, in
// case causes loop)
const signalledIn = (error: unknown): SignalledError | undefined => {
  const seen = new Set<unknown>();
  for (let at = error; at instanceof Error && !seen.has(at); at = at.cause) {
    if (at instanceof SignalledError) return at;
    seen.add(at);
  }
  return undefined;
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// startup installs Sentry, and tests a fake. A new Reporter hears every
// signal afresh
export const setReporter = (next: Reporter) => {
  current = next;
  toldAt.clear();
};

export { log, withRequest } from "./log.ts";
export { scrubText } from "@empire-cleaning/models";
export { type Signal, type Urgency } from "./signals.ts";
export { type Measure, type Unit } from "./measures.ts";
