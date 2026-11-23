import { useId, useState } from "react";
import type { CalendarDate, Time } from "@internationalized/date";
import { ChevronLeft, ChevronRight, Keyboard } from "lucide-react";
import {
  addDays,
  clockTime,
  daysIn,
  formats,
  mondayOf,
  quarterHours,
  weekdayOf,
  type OpenDay,
} from "@empire-cleaning/models";
import {
  Button,
  DatePicker,
  FieldRow,
  Notice,
  TimeField,
  TimeTiles,
  staleFade,
  useOpenOnInvalid,
} from "@empire-cleaning/ui";
import { getJson } from "../../api.ts";
import { useLoaded } from "../load.ts";
import { timeOfField, today } from "../format.ts";
import { hoursOf } from "../schedule-layout.ts";

const { formatClock, formatDay, formatShortDay, weekdayName } = formats.en;

// a weekday's strip pages through seven of its dates at a time
const WEEKS = 7;

// what's wrong with the time picked, as last saved, in the tone it takes:
// a warning while it can still be sent (no room then), danger while Send
// refuses it (too soon, past midnight). `flags` marks the picked tile too,
// when it's the quote's own clean the lines are about, not only the
// Service recommended beside it.
export type TimeProblem = {
  tone: "warning" | "danger";
  lines: string[];
  flags: boolean;
};

type Props = {
  quoteId: string;
  // a plan's weekday, counting from 0 in the Draft's order; none on a one-off
  weekday?: number;
  // what it's called on a plan ("Mondays", "Weekday 2"), so each weekday's
  // tiles are told apart when read aloud
  title?: string;
  // how many saves have landed: the open times load again after each
  saves: number;
  // its clean's time on site as last saved, for when a picked time ends;
  // none before the Draft has a price, so no open times either
  hoursOnSite: number | undefined;
  date: CalendarDate | null;
  time: Time | null;
  // the plan's other weekdays (0 Monday), which this one can't be on
  taken?: number[];
  problem?: TimeProblem;
  // a change is being saved: what's shown is of the Draft before it
  stale: boolean;
  // where the API's errors for its time are reported: "proposedStart",
  // "plan.days.0.start"
  name: string;
  onChange: (change: {
    date?: CalendarDate | null;
    time?: Time | null;
  }) => void;
  onPick: (picked: { date: string; time: string }) => void;
};

// when a clean starting at `time` ends, "2:30 PM", by its time on site as
// it's booked (to the quarter hour); none past midnight
export const endsAt = (time: string, hoursOnSite: number) => {
  const minutes = (hoursOf(time) + quarterHours(hoursOnSite)) * 60;
  return minutes < 24 * 60 ? formatClock(clockTime(minutes)) : undefined;
};

// the strip's first date showing `date`: its week's Monday, or on a dated
// weekday, the page of seven of its dates from the first one to come
const stripFrom = (date: string | undefined, weekly: boolean) => {
  const now = today();
  if (!weekly || !date) return mondayOf(date ?? now);
  const first = addDays(now, (weekdayOf(date) - weekdayOf(now) + 7) % 7);
  // a page back, too, for a date before it (a clock that's off)
  const page = Math.floor((daysIn(first, date) - 1) / WEEKS / 7);
  return addDays(first, page * WEEKS * 7);
};

/**
 * Office Staff picking a Draft quote's proposed time in a tap, inline in its
 * part (#493, the user's pick B from prototype-proposed-time): a strip of
 * a week's days, each saying why it's shut, over the viewed day's start
 * times that have room, as the server works them out for the Draft as last
 * saved. A plan's weekday, once dated, pages through its own weekday's
 * dates. The picked time is always a tile on its day, open or not, filled
 * with when it ends, or marked with its problem. The date and time fields
 * are behind "Type a date and time", the keyboard's way and a time off the
 * half hour; they stay in the form while folded, so its errors count.
 */
export function PickOpenTime({
  quoteId,
  weekday,
  title,
  saves,
  hoursOnSite,
  date,
  time,
  taken = [],
  problem,
  stale,
  name,
  onChange,
  onPick,
}: Props) {
  const picked = date?.toString();
  const pickedTime = timeOfField(time);
  const weekly = weekday !== undefined && picked !== undefined;
  const step = weekly ? 7 : 1;
  // the strip's first date and the day viewed (none: the picked one, or
  // the first open), kept for the picked date until it changes
  const showing = `${weekly} ${picked}`;
  const [strip, setStrip] = useState({
    for: showing,
    from: stripFrom(picked, weekly),
    viewed: undefined as string | undefined,
  });
  const datesFrom = (from: string) =>
    Array.from({ length: 7 }, (_, i) => addDays(from, i * step));
  if (strip.for !== showing) {
    // a date typed, or the weekday dated: the strip follows it, unless the
    // date's already in it
    const stays = picked && datesFrom(strip.from).includes(picked);
    setStrip({
      for: showing,
      from: stays ? strip.from : stripFrom(picked, weekly),
      viewed: undefined,
    });
  }
  const dates = datesFrom(strip.from);
  const from = dates[0]!;
  const to = dates.at(-1)!;

  const ready = hoursOnSite !== undefined;
  const query = `from=${from}&to=${to}${weekday === undefined ? "" : `&weekday=${weekday}`}`;
  const { value: days, failed } = useLoaded(
    ready ? `${quoteId} ${query} ${saves}` : undefined,
    () =>
      getJson<OpenDay[]>(`/api/quotes/${quoteId}/draft/open-times?${query}`),
    { keep: true },
  );
  const dayOf = (date: string) => days?.find((d) => d.date === date);
  const inPlan = (date: string) => taken.includes(weekdayOf(date));
  // by the server's clock, which decides what can be sent
  const why = (date: string) => {
    const day = dayOf(date);
    if (day?.closed === "past") return "Past";
    if (day?.closed === "soon") return "Too soon";
    if (inPlan(date)) return "In plan";
    if (day?.closed === "full") return "No room";
    return undefined;
  };
  const shut = (date: string) =>
    date !== picked && ["Past", "Too soon", "In plan"].includes(why(date)!);
  const viewed =
    strip.viewed ??
    (picked && dates.includes(picked)
      ? picked
      : (dates.find((d) => !shut(d) && why(d) === undefined) ??
        dates.find((d) => !shut(d)) ??
        from));
  const view = (date: string | undefined) =>
    setStrip({ ...strip, viewed: date });
  const page = (by: number) =>
    setStrip({
      ...strip,
      from: addDays(from, by * 7 * step),
      viewed: undefined,
    });

  // the viewed day's, once loaded: a page just turned to, or a weekday's
  // date typed on another weekday, loads with the next save
  const loading = dayOf(viewed) === undefined && !failed;
  const open = dayOf(viewed)?.times ?? [];
  const onViewed = picked === viewed ? pickedTime : undefined;
  const times =
    onViewed && !open.includes(onViewed)
      ? [...open, onViewed].sort((a, b) => hoursOf(a) - hoursOf(b))
      : open;
  const groups = [
    { name: "Morning", times: times.filter((t) => hoursOf(t) < 12) },
    {
      name: "Afternoon",
      times: times.filter((t) => hoursOf(t) >= 12 && hoursOf(t) < 17),
    },
    { name: "Evening", times: times.filter((t) => hoursOf(t) >= 17) },
  ].filter((g) => g.times.length > 0);
  // when the picked clean ends, on its own day
  const ends = pickedTime && hoursOnSite && endsAt(pickedTime, hoursOnSite);
  const until = ends ? `to ${ends}` : undefined;
  const of = title ? `, ${title}` : "";

  return (
    <div className="flex flex-col gap-4">
      {ready ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="quiet"
                size="icon"
                aria-label={weekly ? "Earlier weeks" : "Previous week"}
                // never a page all gone: the one before a past first day
                isDisabled={dayOf(from)?.closed === "past"}
                onPress={() => page(-1)}
              >
                <ChevronLeft aria-hidden size={20} />
              </Button>
              <p className="font-semibold" aria-live="polite">
                {formatDay(from)} – {formatDay(to)}
              </p>
              <Button
                variant="quiet"
                size="icon"
                aria-label={weekly ? "Later weeks" : "Next week"}
                onPress={() => page(1)}
              >
                <ChevronRight aria-hidden size={20} />
              </Button>
            </div>
            <div
              role="group"
              aria-label={`Days${of}`}
              className="grid grid-cols-7 gap-1"
            >
              {dates.map((date) => {
                const reason = why(date);
                const isPicked = date === picked;
                const isViewed = date === viewed;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={shut(date)}
                    aria-current={isViewed ? "date" : undefined}
                    onClick={() => view(date)}
                    className={`relative flex min-h-touch flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default ${
                      isPicked
                        ? "bg-primary/10 font-semibold text-primary ring-2 ring-primary ring-inset"
                        : shut(date)
                          ? "text-fg-subtle"
                          : reason
                            ? "text-fg-muted hover:bg-surface-sunken"
                            : "hover:bg-surface-sunken"
                    } ${isViewed && !isPicked ? "bg-surface-sunken font-semibold" : ""}`}
                  >
                    {/* read aloud whole, as the day's short words on
                        the tile aren't a name on their own */}
                    <span className="sr-only">
                      {`${formatDay(date)}${reason ? `, ${reason.toLowerCase()}` : ""}${isPicked ? ", picked" : ""}`}
                    </span>
                    <span aria-hidden className="text-xs">
                      {weekly
                        ? formatShortDay(date).split(" ")[0]
                        : weekdayName(date).slice(0, 3)}
                    </span>
                    <span
                      aria-hidden
                      className="text-lg leading-none font-semibold"
                    >
                      {Number(date.slice(8))}
                    </span>
                    {/* two lines held for every day, so a reason that
                        wraps leaves the row even */}
                    <span
                      aria-hidden
                      className="h-8 text-center text-xs leading-4 font-normal"
                    >
                      {reason}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {failed && (
            <Notice tone="danger">
              The open times didn't load. Please try again.
            </Notice>
          )}
          <div
            aria-busy={stale || loading}
            className={`flex flex-col gap-4 ${staleFade(stale)}`}
          >
            {/* the picked time's problem, over the tile it marks */}
            {problem &&
              viewed === picked &&
              problem.lines.map((line) => (
                <Notice key={line} tone={problem.tone}>
                  {line}
                </Notice>
              ))}
            {loading ? (
              <p className="text-sm text-fg-muted">Loading open times…</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-fg-muted">
                No time on {formatDay(viewed)} has room for it.
              </p>
            ) : (
              groups.map((group) => (
                <TimeTiles
                  key={group.name}
                  label={`${group.name} on ${formatDay(viewed)}${of}`}
                  heading={group.name}
                  times={group.times}
                  chosen={onViewed}
                  flagged={problem?.flags ? problem.tone : undefined}
                  until={until}
                  onPick={(time) => onPick({ date: viewed, time })}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-fg-muted">
          Open times show once the quote has its price. Meanwhile, type a date
          and time.
        </p>
      )}
      <TypedTime
        name={name}
        date={date}
        time={time}
        // a time off the half hour isn't a tile but on its day; with no
        // open times yet, it's the only way
        defaultOpen={!ready || (time !== null && time.minute % 30 !== 0)}
        onChange={onChange}
      />
    </div>
  );
}

// The keyboard's way, and a time off the half hour: the date and start time
// fields behind a line. Folded, they stay in the form, so the API's error
// for the time is given to them, and opens them to show it.
function TypedTime({
  name,
  date,
  time,
  defaultOpen,
  onChange,
}: {
  name: string;
  date: CalendarDate | null;
  time: Time | null;
  defaultOpen: boolean;
  onChange: Props["onChange"];
}) {
  // a time that's wrong opens them, so it can be shown
  const { ref, open, setOpen, onInvalidCapture } =
    useOpenOnInvalid(defaultOpen);
  const fieldsId = useId();
  return (
    <div className="flex flex-col gap-4">
      {!open && (
        <Button
          variant="text"
          size="sm"
          flush="start"
          className="self-start"
          aria-expanded={false}
          aria-controls={fieldsId}
          onPress={() => setOpen(true)}
        >
          <Keyboard aria-hidden size={16} />
          Type a date and time
        </Button>
      )}
      <div
        ref={ref}
        id={fieldsId}
        hidden={!open}
        onInvalidCapture={onInvalidCapture}
      >
        <FieldRow packed>
          <DatePicker
            label="Date"
            name={name}
            value={date}
            onChange={(date) => onChange({ date })}
          />
          <TimeField
            label="Start time"
            value={time}
            onChange={(time) => onChange({ time })}
          />
        </FieldRow>
      </div>
    </div>
  );
}
