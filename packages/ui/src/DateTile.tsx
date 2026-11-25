import { formats } from "@empire-cleaning/models";
import { useLanguage } from "./language.ts";
import { tv } from "./utils.ts";

const tile = tv({
  slots: {
    base: "flex shrink-0 flex-col items-center overflow-hidden border border-border bg-surface text-center",
    month:
      "w-full bg-primary font-bold tracking-widest text-primary-fg uppercase",
    day: "font-display leading-none font-bold text-fg",
  },
  variants: {
    // for something that won't happen (a Job cancelled, or one the crew
    // couldn't get into): a page greyed, not the brand's colour
    muted: {
      true: {
        month: "bg-surface-sunken text-fg-muted",
        day: "text-fg-muted",
      },
    },
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
  defaultVariants: { size: "md", muted: false },
});

// a page off a calendar: the month on a band, the day large and, at md,
// the weekday under it, for when something booked is. Decorative: say the
// date in text beside it. Days are Empire Cleaning's, New York's, wherever
// the viewer is, in the language LanguageProvider gives.
export function DateTile({
  date,
  size = "md",
  muted = false,
}: {
  // an instant, e.g. "2026-11-03T14:00:00Z"
  date: string;
  size?: "md" | "sm";
  muted?: boolean;
}) {
  const parts = formats[useLanguage()].dateTile(date);
  const { base, month, day } = tile({ size, muted });
  return (
    <span aria-hidden className={base()}>
      <span className={month()}>{parts.month}</span>
      <span className={day()}>{parts.day}</span>
      {size === "md" && (
        <span className="pb-2 text-sm text-fg-muted">{parts.weekday}</span>
      )}
    </span>
  );
}
