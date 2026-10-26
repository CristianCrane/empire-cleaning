import { useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  StatusBadge,
} from "@empire-cleaning/ui";
import {
  HOUR_PX,
  PickSlot,
  RangeBar,
  TimeGrid,
  type TimePickerProps,
} from "./CalendarGrid.tsx";
import { addDays, formatClock, formatDay, today } from "./format.ts";
import { axisFor, hoursOf } from "./schedule-layout.ts";
import { daysIn, isWide, rangeShowing } from "./schedule-range.ts";

/**
 * A Client choosing a new time for their clean on a calendar, the way the
 * Office picks from the Schedule but showing only what's theirs to see: the
 * start times on offer on days with room, and where their clean is now.
 */
export function PickAvailableTime(props: TimePickerProps) {
  return (
    <DialogTrigger>
      <Button variant="secondary" className="self-start">
        <CalendarDays aria-hidden size={20} />
        Pick on the calendar
      </Button>
      <Dialog title="Open times" size="wide">
        {({ close }) => <OpenTimes {...props} close={close} />}
      </Dialog>
    </DialogTrigger>
  );
}

function OpenTimes({
  date,
  time,
  current,
  limits,
  onPick,
  close,
}: TimePickerProps & { close: () => void }) {
  // a week where there's room for one, otherwise a day
  const [range, setRange] = useState(() =>
    rangeShowing(isWide() ? 7 : 1, date ?? current?.date ?? today()),
  );
  const dates = Array.from({ length: daysIn(range.from, range.to) }, (_, i) =>
    addDays(range.from, i),
  );
  const times = [...(limits?.times ?? [])].sort();
  const axis = axisFor(
    [],
    times.map((t) => ({ start: hoursOf(t), end: hoursOf(t) + 1 })),
  );
  // each time reaches down to the next, an hour at most
  const heightOf = (i: number) =>
    Math.min(
      i + 1 < times.length ? hoursOf(times[i + 1]!) - hoursOf(times[i]!) : 1,
      1,
    );
  const isOpen = (day: string) => limits?.days.includes(day) ?? false;
  const isNow = (day: string, t: string) =>
    day === current?.date && t === current.time;

  return (
    <>
      <p className="text-sm text-fg-muted">
        Choose a start time. A day without times has no room for your clean. New
        York time.
      </p>
      <RangeBar
        from={range.from}
        to={range.to}
        onShow={(span, day) => setRange(rangeShowing(span, day))}
      />
      <TimeGrid
        axis={axis}
        columns={dates.map((day) => ({
          date: day,
          header: (
            <header
              className={`flex flex-col gap-1 border-b border-border p-2 ${isOpen(day) ? "" : "bg-surface-sunken"}`}
            >
              <Heading level={2} size={4} className="text-sm">
                {formatDay(day)}
              </Heading>
              {day === current?.date ? (
                <StatusBadge tone="info">Your clean</StatusBadge>
              ) : (
                !isOpen(day) && (
                  <p className="text-xs text-fg-muted">No times</p>
                )
              )}
            </header>
          ),
          bodyLabel: `Times on ${formatDay(day)}`,
          bodyProps: {
            className: isOpen(day) ? "" : "bg-surface-sunken",
          },
          body: times.map((t, i) =>
            isNow(day, t) ? (
              <div
                key={t}
                className="absolute inset-x-0.5 rounded-md border-2 border-dashed border-info-strong bg-info-subtle px-1.5 py-0.5 text-xs leading-tight font-semibold"
                style={{
                  top: (hoursOf(t) - axis.start) * HOUR_PX + 1,
                  height: heightOf(i) * HOUR_PX - 2,
                }}
              >
                {formatClock(t)} Your clean now
              </div>
            ) : (
              isOpen(day) && (
                <PickSlot
                  key={t}
                  at={{ date: day, time: t }}
                  axisStart={axis.start}
                  hours={heightOf(i)}
                  isSelected={day === date && t === time}
                  className="border border-border-strong font-semibold"
                  onPick={(at) => {
                    onPick(at);
                    close();
                  }}
                >
                  {formatClock(t)}
                </PickSlot>
              )
            ),
          ),
        }))}
      />
      <Actions>
        <Button variant="secondary" onPress={close}>
          Close
        </Button>
      </Actions>
    </>
  );
}
