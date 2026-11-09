import type {
  Context,
  Measure,
  Reporter,
  Signal,
  Unit,
  Urgency,
} from "#services/monitoring";

// records what would have gone to Sentry
export class FakeReporter implements Reporter {
  readonly errors: { error: unknown; context: Context }[] = [];
  readonly signals: { name: Signal; urgency: Urgency; context: Context }[] = [];
  readonly measures: {
    name: Measure;
    value: number;
    unit: Unit;
    context: Context;
  }[] = [];
  heartbeats = 0;

  error(error: unknown, context: Context) {
    this.errors.push({ error, context });
  }

  signal(name: Signal, urgency: Urgency, context: Context) {
    this.signals.push({ name, urgency, context });
  }

  measure(name: Measure, value: number, unit: Unit, context: Context) {
    this.measures.push({ name, value, unit, context });
  }

  heartbeat() {
    this.heartbeats++;
  }

  signalled(name: Signal) {
    return this.signals.filter((s) => s.name === name);
  }
}
