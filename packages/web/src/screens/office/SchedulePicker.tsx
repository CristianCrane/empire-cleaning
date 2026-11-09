import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { ScheduleDay } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Notice,
} from "@empire-cleaning/ui";
import { getJson } from "../../api.ts";
import { useLoaded } from "../load.ts";
import { RangeBar, type TimePickerProps } from "../CalendarGrid.tsx";
import { today, weekdayName } from "../format.ts";
import type { Crew } from "../schedule-layout.ts";
import { isWide, rangeShowing } from "../schedule-range.ts";
import { ScheduleCalendar } from "./ScheduleCalendar.tsx";

type Props = TimePickerProps & {
  // a Service Plan's: how many weeks apart its cleans are, and in words
  repeats?: { everyWeeks: number; label: string };
  // what the chosen time's block is called: "This clean" unless said
  label?: string;
  // the clean's crew, to mark the times without one free (#62)
  crew?: Crew;
  // the Schedule in place, in a dialog made wide for it, never a dialog on
  // a dialog (#96); a Button opening it in its own otherwise
  inline?: boolean;
};

/**
 * Office Staff choosing when a clean starts from the Schedule: the week
 * around the date chosen so far, with its Jobs and free Cleaner hours.
 * Choosing a time sets the date and start time: any half hour, or for a
 * Reschedule Request, one of the times on offer on a day with room. Times
 * with no crew free for the clean are marked.
 */
export function PickFromSchedule(props: Props) {
  if (props.inline) return <PickStart {...props} />;
  return (
    <DialogTrigger>
      {/* the way to the Schedule, under the date and time it sets: full width
          on a phone, centred beneath them on a larger screen */}
      <Button variant="secondary" className="w-full sm:w-auto sm:self-center">
        <CalendarDays aria-hidden size={20} />
        Pick from the schedule
      </Button>
      <Dialog title="Pick from the schedule" size="wide">
        {({ close }) => <PickStart {...props} close={close} />}
      </Dialog>
    </DialogTrigger>
  );
}

function PickStart({
  date,
  time,
  hoursOnSite,
  current,
  limits,
  repeats,
  label = "This clean",
  crew,
  onPick,
  close,
}: Props & { close?: () => void }) {
  // a week where there's room for one, otherwise a day
  const [range, setRange] = useState(() =>
    rangeShowing(isWide() ? 7 : 1, date ?? current?.date ?? today()),
  );
  const query = `from=${range.from}&to=${range.to}`;
  // the range on screen, not one asked for before it
  const { value: days, failed: problem } = useLoaded(query, () =>
    getJson<ScheduleDay[]>(`/api/schedule?${query}`),
  );
  // a time chosen, other than where the clean is now, which shows already
  const chosen =
    date && time && !(date === current?.date && time === current.time)
      ? { date, time }
      : undefined;

  return (
    <>
      <p className="text-sm text-fg-muted">
        {limits
          ? "Pick a start time. Grey days are full."
          : "Pick a time to start the clean."}{" "}
        {crew && !limits && "Striped times don't have enough cleaners free. "}
        New York time.
        {date &&
          repeats &&
          ` Then ${repeats.label.toLowerCase()} on ${weekdayName(date)}s.`}
      </p>
      <RangeBar
        from={range.from}
        to={range.to}
        onShow={(span, day) => setRange(rangeShowing(span, day))}
      />
      {problem && (
        <Notice tone="danger">
          The schedule didn't load. Please try again.
        </Notice>
      )}
      {!days && !problem && <p className="text-fg-muted">Loading…</p>}
      {days && (
        <ScheduleCalendar
          days={days}
          limits={limits}
          crew={crew && { ...crew, hoursOnSite }}
          proposed={
            chosen && {
              start: chosen,
              hoursOnSite,
              label,
              everyWeeks: repeats?.everyWeeks,
            }
          }
          onPick={(at) => {
            onPick(at);
            close?.();
          }}
        />
      )}
      {close && (
        <Actions>
          <Button variant="quiet" onPress={close}>
            Close
          </Button>
        </Actions>
      )}
    </>
  );
}
