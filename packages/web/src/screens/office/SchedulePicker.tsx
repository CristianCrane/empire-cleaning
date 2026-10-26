import { useEffect, useState } from "react";
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
import { RangeBar, type TimePickerProps } from "../CalendarGrid.tsx";
import { today, weekdayOf } from "../format.ts";
import { isWide, rangeShowing } from "../schedule-range.ts";
import { ScheduleCalendar } from "./ScheduleCalendar.tsx";

type Props = TimePickerProps & {
  // a Service Plan's: how many weeks apart its cleans are, and in words
  repeats?: { everyWeeks: number; label: string };
  // what the chosen time's block is called: "This clean" unless said
  label?: string;
};

/**
 * Office Staff choosing when a clean starts from the Schedule: the week
 * around the date chosen so far, with its Jobs and free Cleaner hours.
 * Choosing a time sets the date and start time: any half hour, or for a
 * Reschedule Request, one of the times on offer on a day with room.
 */
export function PickFromSchedule(props: Props) {
  return (
    <DialogTrigger>
      <Button variant="secondary" className="self-start">
        <CalendarDays aria-hidden size={20} />
        Pick from the Schedule
      </Button>
      <Dialog title="Pick from the Schedule" size="wide">
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
  onPick,
  close,
}: Props & { close: () => void }) {
  // a week where there's room for one, otherwise a day
  const [range, setRange] = useState(() =>
    rangeShowing(isWide() ? 7 : 1, date ?? current?.date ?? today()),
  );
  const query = `from=${range.from}&to=${range.to}`;
  const [found, setFound] = useState<{ query: string; days: ScheduleDay[] }>();
  const [problem, setProblem] = useState(false);

  useEffect(() => {
    let current = true;
    setProblem(false);
    getJson<ScheduleDay[]>(`/api/schedule?${query}`)
      .then((days) => current && setFound({ query, days }))
      .catch(() => current && setProblem(true));
    return () => {
      current = false;
    };
  }, [query]);

  // the range on screen, not one asked for before it
  const days = found?.query === query ? found.days : undefined;
  // a time chosen, other than where the clean is now, which shows already
  const chosen =
    date && time && !(date === current?.date && time === current.time)
      ? { date, time }
      : undefined;

  return (
    <>
      <p className="text-sm text-fg-muted">
        {limits
          ? "Choose one of the start times on offer. Days without room for this clean are greyed out."
          : "Choose a time to start the clean there."}{" "}
        New York time.
        {date &&
          repeats &&
          ` Then ${repeats.label.toLowerCase()} on ${weekdayOf(date)}s.`}
      </p>
      <RangeBar
        from={range.from}
        to={range.to}
        onShow={(span, day) => setRange(rangeShowing(span, day))}
      />
      {problem && (
        <Notice tone="danger">
          The Schedule couldn't be loaded. Please try again.
        </Notice>
      )}
      {!days && !problem && <p className="text-fg-muted">Loading…</p>}
      {days && (
        <ScheduleCalendar
          days={days}
          limits={limits}
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
            close();
          }}
        />
      )}
      <Actions>
        <Button variant="secondary" onPress={close}>
          Close
        </Button>
      </Actions>
    </>
  );
}
