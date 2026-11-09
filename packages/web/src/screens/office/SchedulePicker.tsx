import { formats } from "@empire-cleaning/models";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DayTimes, ScheduleDay } from "@empire-cleaning/models";
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
import { today } from "../format.ts";
import { isWide, rangeShowing } from "../schedule-range.ts";
import { ScheduleCalendar } from "./ScheduleCalendar.tsx";

const { weekdayName } = formats.en;

// whose crew the picker marks the times without (#62): a clean's, by its
// figures, and a booked Job or Site Visit being moved, so it isn't counted
// against itself; or a Draft quote's as last saved (a plan's weekday,
// counting from 0), the Jobs it would replace counted as gone, as its room
// line counts them. `saves` counts the Draft's saves, so the marks load
// again after each.
export type Crew =
  | {
      labourHours: number;
      crewSize: number;
      jobId?: string;
      siteVisitId?: string;
    }
  | { quoteId: string; weekday?: number; saves: number };

// where the server says which starts on the days shown have no crew free
// for it
const startsOf = (crew: Crew, range: string) => {
  if ("quoteId" in crew) {
    const weekday =
      crew.weekday === undefined ? "" : `&weekday=${crew.weekday}`;
    return `/api/quotes/${crew.quoteId}/draft/starts?${range}${weekday}`;
  }
  const figures = Object.entries(crew).flatMap(([key, value]) =>
    value === undefined ? [] : [[key, String(value)]],
  );
  return `/api/schedule/starts?${range}&${new URLSearchParams(figures)}`;
};

type Props = TimePickerProps & {
  // a Service Plan's: how many days apart its cleans are, and in words
  repeats?: { everyDays: number; label: string };
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
 * with no crew free for the clean are marked, as the server says.
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
  const starts = crew && startsOf(crew, query);
  // the range on screen, not one asked for before it, and its marks with it
  const { value: loaded, failed: problem } = useLoaded(
    `${query} ${JSON.stringify(crew)}`,
    () =>
      Promise.all([
        getJson<ScheduleDay[]>(`/api/schedule?${query}`),
        starts ? getJson<DayTimes[]>(starts) : undefined,
      ]),
  );
  const [days, noCrew] = loaded ?? [];
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
          noCrew={noCrew}
          proposed={
            chosen && {
              start: chosen,
              hoursOnSite,
              label,
              everyDays: repeats?.everyDays,
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
