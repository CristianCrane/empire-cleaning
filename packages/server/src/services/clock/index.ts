export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

let current: Clock = systemClock;

// all time-dependent rules (expiry, cancellation cut-offs, ...) read the time through here
export const clock: Clock = {
  now: () => current.now(),
};

export const setClock = (next: Clock) => {
  current = next;
};
