import { formats } from "@empire-cleaning/models";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ToggleButton } from "react-aria-components";
import { useLanguage } from "./language.ts";
import { focusRing, tv } from "./utils.ts";

const tile = tv({
  base: "flex min-h-touch cursor-pointer flex-col items-center justify-center rounded-md font-semibold tabular-nums",
  variants: {
    state: {
      open: "bg-primary/10 text-primary hover:bg-primary/20",
      chosen: "bg-primary text-primary-fg",
      // where it's booked now: shown, so the reader keeps their place, and
      // can't be picked
      current:
        "cursor-default border-2 border-dashed border-border-strong text-fg-muted",
      // chosen, with a problem the line above the tiles says: no room then
      // (a warning, as it can still be sent), or one that stops it (danger)
      warning:
        "border-2 border-dashed border-warning-strong bg-warning-subtle text-warning-strong",
      danger:
        "border-2 border-dashed border-danger-strong bg-danger-subtle text-danger-strong",
    },
  },
});

/**
 * A day's start times to pick from, a tile each, in rows of three, as booking
 * anywhere reads: open, chosen (filled, with `until` under it, e.g. when the
 * clean ends), the time it's booked at now (`current`, dashed, can't be
 * picked) or chosen with a problem (`flagged`: dashed, in the warning's or
 * danger's colour, with a mark). The Client's open times (AvailabilityPicker)
 * and the Office's (OpenTimePicker). Each tile reads its time aloud, or
 * `tileLabel`'s words.
 */
export function TimeTiles({
  label,
  heading,
  times,
  chosen,
  current,
  flagged,
  until,
  tileLabel,
  onPick,
}: {
  // the group's name, read aloud, e.g. "Open times on Mon, Jan 12"
  label: string;
  heading?: ReactNode;
  // times of day, "14:00", in order
  times: string[];
  chosen?: string;
  current?: string;
  // the chosen time's problem, if it has one
  flagged?: "warning" | "danger";
  until?: string;
  tileLabel?: (time: string) => string;
  onPick: (time: string) => void;
}) {
  const { formatClock } = formats[useLanguage()];
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      {heading && <span className="font-semibold">{heading}</span>}
      <div className="grid grid-cols-3 gap-2">
        {times.map((time) => {
          const state =
            time === current
              ? "current"
              : time !== chosen
                ? "open"
                : (flagged ?? "chosen");
          return (
            <ToggleButton
              key={time}
              isSelected={time === chosen}
              isDisabled={state === "current"}
              aria-label={tileLabel?.(time)}
              onPress={() => onPick(time)}
              className={(renderProps) =>
                `${focusRing(renderProps)} ${tile({ state })}`
              }
            >
              <span className="flex items-center gap-1">
                {state === flagged && (
                  <CircleAlert aria-hidden size={16} className="shrink-0" />
                )}
                {formatClock(time)}
              </span>
              {time === chosen && until && (
                <span className="text-xs font-normal">{until}</span>
              )}
            </ToggleButton>
          );
        })}
      </div>
    </div>
  );
}
