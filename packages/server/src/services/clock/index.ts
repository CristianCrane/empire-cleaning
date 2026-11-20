import { dayOf } from "@empire-cleaning/models";

export interface Clock {
  now(): Date;
}

const systemClock: Clock = {
  now: () => new Date(),
};

let current: Clock = systemClock;

// all time-dependent rules (expiry, cancellation cut-offs, ...) read the time through here
export const clock: Clock = {
  now: () => current.now(),
};

// whether an instant falls on today, in New York, by the Clock: the day a
// Cleaner sees a Job's held-back details, and their today list
export const isToday = (instant: Date) => dayOf(instant) === dayOf(clock.now());

export const setClock = (next: Clock) => {
  current = next;
};
