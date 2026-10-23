import type { Clock } from "#services/clock";

export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date = new Date("2026-01-05T09:00:00Z")) {
    this.current = new Date(start);
  }

  now() {
    return new Date(this.current);
  }

  set(date: Date) {
    this.current = new Date(date);
  }

  advance({ days = 0, hours = 0, minutes = 0 }) {
    const ms = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
    this.current = new Date(this.current.getTime() + ms);
  }
}
