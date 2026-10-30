import { tv } from "./utils.ts";

const tile = tv({
  slots: {
    base: "flex shrink-0 flex-col items-center overflow-hidden border border-border bg-surface text-center",
    month:
      "w-full bg-primary font-bold tracking-widest text-primary-fg uppercase",
    day: "font-display leading-none font-bold text-fg",
  },
  variants: {
    size: {
      // leads a card, e.g. Home's next clean
      md: {
        base: "w-20 rounded-lg",
        month: "py-1 text-xs",
        day: "pt-1 text-4xl",
      },
      // leads a list row
      sm: {
        base: "w-12 rounded-md",
        month: "text-[10px] leading-4",
        day: "py-0.5 text-xl",
      },
    },
  },
  defaultVariants: { size: "md" },
});

// a page off a calendar: the month on a band, the day large and, at md,
// the weekday under it, for when something booked is. Decorative: say the
// date in text beside it. Days are Empire Cleaning's, New York's, wherever
// the viewer is.
export function DateTile({
  date,
  size = "md",
  timeZone = "America/New_York",
}: {
  // an instant, e.g. "2026-11-03T14:00:00Z"
  date: string;
  size?: "md" | "sm";
  timeZone?: string;
}) {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Date(date).toLocaleDateString("en-US", { timeZone, ...options });
  const { base, month, day } = tile({ size });
  return (
    <span aria-hidden className={base()}>
      <span className={month()}>{part({ month: "short" })}</span>
      <span className={day()}>{part({ day: "numeric" })}</span>
      {size === "md" && (
        <span className="pb-2 text-sm text-fg-muted">
          {part({ weekday: "short" })}
        </span>
      )}
    </span>
  );
}
