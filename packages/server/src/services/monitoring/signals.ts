import { HOUR_MS, MINUTE_MS } from "@empire-cleaning/models";

// Business signals (ADR-0007): named, never free-form, each with how loudly
// it's alerted. Sentry's alert rules (#43) route on the urgency tag:
// - urgent: every one is alerted
// - in_bulk: alerted at more than 3 in 15 minutes, as sign-in links stop
// - counted: kept for counting, never alerted
// One that can come in a flood is told at most once in `atMostEvery` ms for
// each context, so it can't use up the monitoring quota
type Spec = {
  urgency: "urgent" | "in_bulk" | "counted";
  atMostEvery?: number;
};

const SIGNALS = {
  // the payment provider is unreachable or erroring (not a decline)
  payment_gateway_error: { urgency: "urgent" },
  // money was taken and is owed back, and the refund didn't go through
  refund_failed: { urgency: "urgent" },
  // the scheduler stopped checking in. Sentry's cron monitor raises it from
  // missed heartbeats; our code never does
  heartbeat_missed: { urgency: "urgent" },
  // a Client disputed a Charge with their bank, which has a deadline to answer
  dispute_opened: { urgency: "urgent" },
  // a site-wide cap on emails to typed addresses was reached, so real
  // people are being refused sign-in links or Quote Requests (#243)
  rate_cap_reached: { urgency: "urgent", atMostEvery: HOUR_MS },
  // a database pool had no connection free for as long as a request may
  // wait, so requests are failing (db/pool.ts, #284)
  db_pool_exhausted: { urgency: "urgent", atMostEvery: MINUTE_MS },
  // the email service refused a message or was unreachable
  email_send_failed: { urgency: "in_bulk" },
  // a Client's card was declined
  charge_declined: { urgency: "counted" },
  // a Charge was refunded in the provider's dashboard, not by us
  refunded_at_provider: { urgency: "counted" },
} as const satisfies Record<string, Spec>;

export type Signal = keyof typeof SIGNALS;
export type Urgency = Spec["urgency"];

export const urgencyOf = (signal: Signal): Urgency => SIGNALS[signal].urgency;

export const windowOf = (signal: Signal): number | undefined =>
  (SIGNALS[signal] as Spec).atMostEvery;
