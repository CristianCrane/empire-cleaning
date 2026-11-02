// Business signals (ADR-0007): named, never free-form, each with how loudly
// it's alerted. Sentry's alert rules (#43) route on the urgency tag:
// - urgent: every one is alerted
// - in_bulk: alerted at more than 3 in 15 minutes, as sign-in links stop
// - counted: kept for counting, never alerted
export const SIGNALS = {
  // the payment provider is unreachable or erroring (not a decline)
  payment_gateway_error: "urgent",
  // money was taken and is owed back, and the refund didn't go through
  refund_failed: "urgent",
  // the scheduler stopped checking in. Sentry's cron monitor raises it from
  // missed heartbeats; our code never does
  heartbeat_missed: "urgent",
  // a Client disputed a Charge with their bank, which has a deadline to answer
  dispute_opened: "urgent",
  // the email service refused a message or was unreachable
  email_send_failed: "in_bulk",
  // a Client's card was declined
  charge_declined: "counted",
  // a Charge was refunded in the provider's dashboard, not by us
  refunded_at_provider: "counted",
} as const;

export type Signal = keyof typeof SIGNALS;
export type Urgency = (typeof SIGNALS)[Signal];

export const urgencyOf = (signal: Signal): Urgency => SIGNALS[signal];
