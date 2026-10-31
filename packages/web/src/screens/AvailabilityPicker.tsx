import { parseDate, type CalendarDate } from "@internationalized/date";
import { Calendar } from "@empire-cleaning/ui";
import type { TimePickerProps } from "./CalendarGrid.tsx";
import { formatClock, formatDay } from "./format.ts";

/**
 * A Client choosing a new time for their clean, the way booking anywhere
 * reads: a month, where only days with room can be picked, then that day's
 * start times on offer. It shows only what's theirs to see, never the
 * Schedule. Sits in the dialog itself, not a dialog of its own. (UX pass,
 * #96)
 */
export function PickAvailableTime({
  date,
  time,
  current,
  limits = [],
  onPick,
}: TimePickerProps) {
  const open = limits.filter((d) => d.times.length > 0);
  const first = open[0]?.date;
  const last = open.at(-1)?.date;
  if (!first || !last) return null;
  const times = open.find((d) => d.date === date)?.times ?? [];
  // the time a day keeps when it's picked: the one chosen, if it's on offer
  const pickDay = (day: string) => {
    const offered = open.find((d) => d.date === day)?.times ?? [];
    onPick({
      date: day,
      time: time && offered.includes(time) ? time : "",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <Calendar<CalendarDate>
          aria-label="Day"
          value={date ? parseDate(date) : null}
          defaultFocusedValue={parseDate(date ?? current?.date ?? first)}
          minValue={parseDate(first)}
          maxValue={parseDate(last)}
          isDateUnavailable={(day) =>
            !open.some((d) => d.date === day.toString())
          }
          onChange={(day) => pickDay(day.toString())}
        />
      </div>
      {date && times.length > 0 ? (
        <div
          role="group"
          aria-label={`Open times on ${formatDay(date)}`}
          className="flex flex-col gap-2"
        >
          <span className="font-semibold">{formatDay(date)}: open times</span>
          <div className="grid grid-cols-3 gap-2">
            {times.map((t) => {
              const isNow = date === current?.date && t === current?.time;
              const chosen = t === time;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={isNow}
                  aria-pressed={chosen}
                  aria-label={`${formatDay(date)}, ${formatClock(t)}${isNow ? " (your clean now)" : ""}`}
                  onClick={() => onPick({ date, time: t })}
                  className={`min-h-touch rounded-md font-semibold tabular-nums ${
                    isNow
                      ? "border-2 border-dashed border-border-strong text-fg-muted"
                      : chosen
                        ? "bg-primary text-primary-fg"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {formatClock(t)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          Only days with room can be picked.
        </p>
      )}
    </div>
  );
}
