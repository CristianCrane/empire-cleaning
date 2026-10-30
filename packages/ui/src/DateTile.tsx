import { twMerge } from "./utils.ts";

// a page off a calendar: the month on a band, the day large, the weekday
// under it, for when something booked is. Decorative: say the date in text
// beside it. Days are Empire Cleaning's, New York's, wherever the viewer is.
export function DateTile({
  date,
  timeZone = "America/New_York",
  className,
}: {
  // an instant, e.g. "2026-11-03T14:00:00Z"
  date: string;
  timeZone?: string;
  className?: string;
}) {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Date(date).toLocaleDateString("en-US", { timeZone, ...options });
  return (
    <span
      aria-hidden
      className={twMerge(
        "flex w-20 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-border bg-surface text-center",
        className,
      )}
    >
      <span className="w-full bg-primary py-1 text-xs font-bold tracking-widest text-primary-fg uppercase">
        {part({ month: "short" })}
      </span>
      <span className="pt-1 font-display text-4xl leading-none font-bold text-fg">
        {part({ day: "numeric" })}
      </span>
      <span className="pb-2 text-sm text-fg-muted">
        {part({ weekday: "short" })}
      </span>
    </span>
  );
}
