import type { Context, Reporter, Signal, Urgency } from "#services/monitoring";

// records what would have gone to Sentry
export class FakeReporter implements Reporter {
  readonly errors: { error: unknown; context: Context }[] = [];
  readonly signals: { name: Signal; urgency: Urgency; context: Context }[] = [];
  heartbeats = 0;

  error(error: unknown, context: Context) {
    this.errors.push({ error, context });
  }

  signal(name: Signal, urgency: Urgency, context: Context) {
    this.signals.push({ name, urgency, context });
  }

  heartbeat() {
    this.heartbeats++;
  }

  signalled(name: Signal) {
    return this.signals.filter((s) => s.name === name);
  }
}
