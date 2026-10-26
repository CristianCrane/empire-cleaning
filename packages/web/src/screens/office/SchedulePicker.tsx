import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { LocalDateTime, ScheduleDay } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Notice,
} from "@empire-cleaning/ui";
import { getJson } from "../../api.ts";
import { today, weekdayOf } from "../format.ts";
import { RangeBar, ScheduleCalendar } from "./ScheduleCalendar.tsx";
import { isWide, rangeShowing } from "./schedule-range.ts";

type Props = {
  // what's chosen so far, if anything
  date?: string;
  time?: string;
  // the clean's time on site, to draw it that long
  hoursOnSite: number;
  // a Service Plan's: how many weeks apart its cleans are, and in words
  repeats?: { everyWeeks: number; label: string };
  onPick: (at: LocalDateTime) => void;
};

/**
 * Choosing when a new clean starts from the Schedule: the week around the
 * date chosen so far, with its Jobs and free Cleaner hours. Choosing a free
 * half hour sets the date and start time.
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
  repeats,
  onPick,
  close,
}: Props & { close: () => void }) {
  // a week where there's room for one, otherwise a day
  const [range, setRange] = useState(() =>
    rangeShowing(isWide() ? 7 : 1, date ?? today()),
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

  return (
    <>
      <p className="text-sm text-fg-muted">
        Choose a time to start the clean there. New York time.
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
          proposed={
            date && time
              ? {
                  start: { date, time },
                  hoursOnSite,
                  everyWeeks: repeats?.everyWeeks,
                }
              : undefined
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
