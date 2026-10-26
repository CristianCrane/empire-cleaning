import { useRef, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  LocalDateTime,
  ScheduleDay,
  ScheduledJob,
} from "@empire-cleaning/models";
import {
  Button,
  Heading,
  Link,
  Select,
  SelectItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  addDays,
  dayOfInstant,
  formatClock,
  formatDay,
  formatHours,
  formatTime,
  timeOfDay,
  today,
} from "../format.ts";
import {
  axisFor,
  hoursOf,
  lanesFor,
  snap,
  SNAP_HOURS,
  spanOf,
  timeAt,
} from "./schedule-layout.ts";
import { daysIn, SPANS, type Span } from "./schedule-range.ts";

// how tall an hour is on the time axis
const HOUR_PX = 48;
// a short Job is still tall enough to read its time and Client
const MIN_BLOCK_PX = 26;
// a time is picked to the half hour, then fine-tuned in the time field
const PICK_HOURS = 0.5;

const spanLabel: Record<Span, string> = { 1: "Day", 3: "3 days", 7: "Week" };
const stepLabel: Record<Span, string> = { 1: "day", 3: "3 days", 7: "week" };

// a Job's colour and its words for it: how it turned out, or whether its
// crew is Confirmed
const toneOf = (job: ScheduledJob) =>
  job.status === "completed"
    ? { label: "Completed", block: "border-success-strong bg-success-subtle" }
    : job.status === "no_access"
      ? { label: "No Access", block: "border-danger-strong bg-danger-subtle" }
      : job.assignment === "assigned"
        ? { label: "Assigned", block: "border-info-strong bg-info-subtle" }
        : {
            label: "Unassigned",
            block: "border-warning-strong bg-warning-subtle",
          };

// whether a Job can move onto a day: its own day always has room for it
const hasRoomFor = (day: ScheduleDay, job: ScheduledJob) =>
  day.date === dayOfInstant(job.startsAt) ||
  Math.round(day.freeHours * 100) >= Math.round(job.labourHours * 100);

/**
 * Moving through the Schedule: back and forward a step, back to today, and
 * how many days to show at once.
 */
export function RangeBar({
  from,
  to,
  onShow,
}: {
  from: string;
  to: string;
  onShow: (span: Span, day: string) => void;
}) {
  const span = daysIn(from, to) as Span;
  // the day to keep in view when the span changes: today, if it's shown
  const anchor = today() >= from && today() <= to ? today() : from;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="quiet"
          size="icon"
          aria-label={`Previous ${stepLabel[span]}`}
          onPress={() => onShow(span, addDays(from, -span))}
        >
          <ChevronLeft aria-hidden size={20} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => onShow(span, today())}
        >
          {span === 7 ? "This week" : "Today"}
        </Button>
        <Button
          variant="quiet"
          size="icon"
          aria-label={`Next ${stepLabel[span]}`}
          onPress={() => onShow(span, addDays(from, span))}
        >
          <ChevronRight aria-hidden size={20} />
        </Button>
        <p className="font-semibold" aria-live="polite">
          {from === to
            ? formatDay(from)
            : `${formatDay(from)} – ${formatDay(to)}`}
        </p>
      </div>
      <Select
        label="Show"
        className="w-32"
        selectedKey={span}
        onSelectionChange={(key) => onShow(Number(key) as Span, anchor)}
      >
        {SPANS.map((s) => (
          <SelectItem key={s} id={s} textValue={spanLabel[s]}>
            {spanLabel[s]}
          </SelectItem>
        ))}
      </Select>
    </div>
  );
}

// a clean not yet booked, placed on the calendar: when it starts, its time on
// site, and for a Service Plan, how many weeks apart its cleans are
export type Proposed = {
  start: LocalDateTime;
  hoursOnSite: number;
  everyWeeks?: number;
};

// whether a Service Plan's later clean falls on a day
const repeatsOn = (proposed: Proposed | undefined, date: string) => {
  if (!proposed?.everyWeeks || date <= proposed.start.date) return false;
  return (
    (daysIn(proposed.start.date, date) - 1) % (7 * proposed.everyWeeks) === 0
  );
};

type Dragging = { job: ScheduledJob; grabbedAtPx: number };

/**
 * The Schedule as a calendar: days as columns over a time axis, each Job a
 * block placed at its start and sized by its time on site.
 *
 * On the Schedule itself (onDrop), clicking a Job opens it and dragging one
 * moves it. To choose a time instead (onPick), the Jobs are only there to
 * see, and clicking a free half hour picks it; a proposed clean is drawn
 * where it would go.
 */
export function ScheduleCalendar({
  days,
  onDrop,
  onPick,
  proposed,
}: {
  days: ScheduleDay[];
  onDrop?: (job: ScheduledJob, to: LocalDateTime) => void;
  onPick?: (at: LocalDateTime) => void;
  proposed?: Proposed;
}) {
  const proposedStart = proposed && hoursOf(proposed.start.time);
  const axis = axisFor(
    days.flatMap((d) => d.jobs),
    proposedStart === undefined
      ? []
      : [{ start: proposedStart, end: proposedStart + proposed!.hoursOnSite }],
  );
  const hours = Array.from(
    { length: axis.end - axis.start },
    (_, i) => axis.start + i,
  );
  const slots = Array.from(
    { length: (axis.end - axis.start) / PICK_HOURS },
    (_, i) => axis.start + i * PICK_HOURS,
  );
  // which Job is being dragged, and how far down it was grabbed, so it lands
  // where it's let go; state too, so days without room for it fade
  const dragging = useRef<Dragging>(undefined);
  const [draggedJob, setDraggedJob] = useState<ScheduledJob>();
  const wide = days.length === 7;

  const drop = (day: ScheduleDay, e: DragEvent<HTMLElement>) => {
    const grabbed = dragging.current;
    if (!onDrop || !grabbed || !hasRoomFor(day, grabbed.job)) return;
    e.preventDefault();
    const top =
      e.clientY -
      e.currentTarget.getBoundingClientRect().top -
      grabbed.grabbedAtPx;
    const at = Math.min(
      Math.max(snap(axis.start + top / HOUR_PX), axis.start),
      axis.end - SNAP_HOURS,
    );
    const to = { date: day.date, time: timeAt(at) };
    const { job } = grabbed;
    if (
      to.date !== dayOfInstant(job.startsAt) ||
      to.time !== timeOfDay(job.startsAt)
    ) {
      onDrop(job, to);
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <div
        className="grid grid-rows-[auto_1fr]"
        style={{
          gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(${wide ? "6.5rem" : "0"}, 1fr))`,
        }}
      >
        <div className="row-span-2 grid grid-rows-subgrid">
          <div className="border-b border-border" />
          {/* each hour's label level with its line, the first just below
              the header */}
          <div aria-hidden className="relative">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 pe-2 text-end text-xs leading-none text-fg-muted"
                style={{ top: i === 0 ? 2 : i * HOUR_PX - 6 }}
              >
                {formatClock(timeAt(h))}
              </div>
            ))}
          </div>
        </div>
        {days.map((day) => (
          <section
            key={day.date}
            aria-label={formatDay(day.date)}
            className={`row-span-2 grid min-w-0 grid-rows-subgrid border-s border-border transition-opacity ${draggedJob && !hasRoomFor(day, draggedJob) ? "opacity-40" : ""}`}
          >
            <DayHeader
              day={day}
              marker={
                proposed?.start.date === day.date
                  ? "Starts"
                  : repeatsOn(proposed, day.date)
                    ? "Repeats"
                    : undefined
              }
            />
            <div
              role="group"
              aria-label={`Jobs on ${formatDay(day.date)}`}
              className={`relative ${day.staffHours === 0 ? "bg-surface-sunken" : ""}`}
              style={{ height: hours.length * HOUR_PX }}
              onDragOver={(e) => {
                const grabbed = dragging.current;
                if (grabbed && hasRoomFor(day, grabbed.job)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => drop(day, e)}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="border-t border-border first:border-t-0"
                  style={{ height: HOUR_PX }}
                />
              ))}
              {/* the keyboard's way is the date and time fields, so the
                  slots stay out of the tab order */}
              {onPick &&
                slots.map((at) => (
                  <Button
                    key={at}
                    variant="quiet"
                    excludeFromTabOrder
                    aria-label={`${formatDay(day.date)}, ${formatClock(timeAt(at))}`}
                    className="group absolute inset-x-0 min-h-0 justify-start rounded-none px-1 text-xs font-normal text-fg-muted"
                    style={{
                      top: (at - axis.start) * HOUR_PX,
                      height: HOUR_PX * PICK_HOURS,
                    }}
                    onPress={() => onPick({ date: day.date, time: timeAt(at) })}
                  >
                    <span className="opacity-0 group-hover:opacity-100">
                      {formatClock(timeAt(at))}
                    </span>
                  </Button>
                ))}
              <DayJobs
                jobs={day.jobs}
                axisStart={axis.start}
                interactive={onDrop !== undefined}
                onDragStart={(grabbed) => {
                  dragging.current = grabbed;
                  setDraggedJob(grabbed.job);
                }}
                onDragEnd={() => {
                  dragging.current = undefined;
                  setDraggedJob(undefined);
                }}
              />
              {proposed?.start.date === day.date && (
                <div
                  className="pointer-events-none absolute inset-x-0.5 overflow-hidden rounded-md border-2 border-dashed border-primary bg-primary/15 px-1.5 py-1 text-xs leading-tight font-semibold"
                  style={{
                    top: (proposedStart! - axis.start) * HOUR_PX + 1,
                    height: Math.max(
                      proposed.hoursOnSite * HOUR_PX - 2,
                      MIN_BLOCK_PX,
                    ),
                  }}
                >
                  {formatClock(proposed.start.time)} This clean
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// a day's Cleaner hours: booked, held for Reschedule Requests, and free,
// as a bar and in words; greyed when nobody is available
function DayHeader({ day, marker }: { day: ScheduleDay; marker?: string }) {
  const total = Math.max(day.staffHours, day.bookedHours + day.heldHours, 1);
  const width = (hours: number) => `${Math.min((hours / total) * 100, 100)}%`;
  const isToday = day.date === today();
  const nobody = day.staffHours === 0;

  return (
    <header
      className={`flex flex-col gap-1 border-b border-border p-2 ${isToday ? "bg-info-subtle" : nobody ? "bg-surface-sunken" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <Heading level={2} size={4} className="text-sm">
          {formatDay(day.date)}
        </Heading>
        {marker && <StatusBadge tone="info">{marker}</StatusBadge>}
      </div>
      <div
        aria-hidden
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={day.freeHours < 0 ? "bg-danger" : "bg-primary"}
          style={{ width: width(day.bookedHours) }}
        />
        <div
          className="bg-warning-strong"
          style={{ width: width(day.heldHours) }}
        />
      </div>
      <p className="text-xs text-fg-muted">
        {nobody && day.bookedHours === 0
          ? "Nobody available"
          : [
              `${formatHours(day.bookedHours)} booked`,
              ...(day.heldHours > 0
                ? [`${formatHours(day.heldHours)} held`]
                : []),
              day.freeHours < 0
                ? `${formatHours(-day.freeHours)} over`
                : `${formatHours(day.freeHours)} free`,
            ].join(" · ")}
      </p>
    </header>
  );
}

// each Job's block; on the Schedule, a link to the Job that can be dragged,
// otherwise only to see, letting clicks through to the time under it
function DayJobs({
  jobs,
  axisStart,
  interactive,
  onDragStart,
  onDragEnd,
}: {
  jobs: ScheduledJob[];
  axisStart: number;
  interactive: boolean;
  onDragStart: (grabbed: Dragging) => void;
  onDragEnd: () => void;
}) {
  const lanes = lanesFor(jobs);

  return jobs.map((job) => {
    const { start } = spanOf(job);
    const { lane, lanes: of } = lanes.get(job.id)!;
    const tone = toneOf(job);
    const crew = job.crew.map((c) => c.name).join(", ");
    const words = (
      <>
        <span className="truncate font-semibold">
          {formatTime(job.startsAt)} {job.client.name}
        </span>
        <span className="truncate">{tone.label}</span>
        <span className="truncate text-fg-muted">{crew || "No crew yet"}</span>
      </>
    );
    const inside =
      "flex h-full flex-col px-1.5 py-1 text-xs leading-tight font-normal text-fg no-underline";
    return (
      <div
        key={job.id}
        draggable={interactive && job.movable}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", job.id);
          onDragStart({
            job,
            grabbedAtPx:
              e.clientY - e.currentTarget.getBoundingClientRect().top,
          });
        }}
        onDragEnd={onDragEnd}
        className={`absolute overflow-hidden rounded-md border-s-4 shadow-sm ${tone.block} ${!interactive ? "pointer-events-none" : job.movable ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{
          top: (start - axisStart) * HOUR_PX + 1,
          height: Math.max(job.hoursOnSite * HOUR_PX - 2, MIN_BLOCK_PX),
          left: `calc(${(lane / of) * 100}% + 2px)`,
          width: `calc(${100 / of}% - 4px)`,
        }}
      >
        {interactive ? (
          <Link
            href={linkTo({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            })}
            className={inside}
          >
            {words}
          </Link>
        ) : (
          <div className={inside}>{words}</div>
        )}
      </div>
    );
  });
}
