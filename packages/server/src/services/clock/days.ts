// Empire Cleaning's days are New York's: a Job at 11pm on the 3rd is on the
// 3rd, wherever the server runs. A day is written "2026-11-03".

export const BUSINESS_TIME_ZONE = "America/New_York";

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const wallClock = (instant: Date) => {
  const p = Object.fromEntries(
    parts.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    // the wall-clock reading as if it were UTC, to compare with the instant
    asUtc: Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    ),
  };
};

// the day an instant falls on, in New York
export const dayOf = (instant: Date) => wallClock(instant).day;

// the instant a day starts, in New York (midnight is never skipped there:
// the clocks change at 2am)
export const startOfDay = (day: string) => {
  const midnightUtc = Date.parse(`${day}T00:00:00Z`);
  const offset = (at: number) =>
    wallClock(new Date(at)).asUtc - Math.floor(at / 1000) * 1000;
  const guess = midnightUtc - offset(midnightUtc);
  return new Date(midnightUtc - offset(guess));
};

export const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

// every day from `from` to `to`, both included
export const daysFrom = (from: string, to: string) => {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
};

// 0 for Monday to 6 for Sunday
export const weekdayOf = (day: string) =>
  (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
