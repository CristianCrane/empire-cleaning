// Measures (ADR-0007): named numbers, sampled over time and sent as Sentry
// gauges, each with its unit. A Metric Monitor can alert on one's min, max
// or average over a window (#205)
const MEASURES = {
  // a database pool's connections handed out, by pool (db/pool.ts)
  "db.pool.in_use": "none",
  // its connections open and free
  "db.pool.idle": "none",
  // requests waiting for one of its connections
  "db.pool.waiting": "none",
  // the longest wait for one of its connections that ended since the last
  // sample, given up or not
  "db.pool.wait_max": "millisecond",
} as const;

export type Measure = keyof typeof MEASURES;
export type Unit = (typeof MEASURES)[Measure];

export const unitOf = (measure: Measure): Unit => MEASURES[measure];
