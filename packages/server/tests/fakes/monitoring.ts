import type {
  Alerted,
  Context,
  Measure,
  Reporter,
  Signal,
  Unit,
} from "#services/monitoring";

// records what would have gone to Sentry: a signal as an event (`signals`)
// or, if counted, as a count (`counts`)
export class FakeReporter implements Reporter {
  readonly errors: { error: unknown; context: Context }[] = [];
  readonly signals: { name: Signal; urgency: Alerted; context: Context }[] = [];
  readonly counts: { name: Signal; context: Context }[] = [];
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

  signal(name: Signal, urgency: Alerted, context: Context) {
    this.signals.push({ name, urgency, context });
  }

  count(name: Signal, context: Context) {
    this.counts.push({ name, context });
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

  counted(name: Signal) {
    return this.counts.filter((c) => c.name === name);
  }
}
