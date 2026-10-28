// how emails write money, times, days and names

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
// cents to "$391.04"
export const formatMoney = (cents: number) => money.format(cents / 100);

const when = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});
// "Monday, January 12 at 9:00 AM", in New York
export const formatWhen = (instant: Date) => when.format(instant);

const weekday = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "America/New_York",
});
// "Monday", in New York
export const weekdayName = (instant: Date) => weekday.format(instant);

const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});
// "9:00 AM", in New York
export const formatTime = (instant: Date) => time.format(instant);

const day = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
// "2026-01-12" as "Monday, January 12"
export const formatDay = (isoDate: string) =>
  day.format(new Date(`${isoDate}T12:00:00Z`));

export const firstNameOf = (name: string) => name.split(" ")[0]!;
