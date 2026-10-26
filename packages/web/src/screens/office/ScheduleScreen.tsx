import { useRef, useState, type DragEvent } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  LocalDateTime,
  ScheduleDay,
  ScheduledJob,
} from "@empire-cleaning/models";
import {
  Button,
  Dialog,
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
import { ConfirmMove } from "./JobMove.tsx";
import {
  axisFor,
  lanesFor,
  snap,
  SNAP_HOURS,
  spanOf,
  timeAt,
} from "./schedule-layout.ts";
import {
  rangeShowing,
  scheduleRange,
  SPANS,
  type Span,
} from "./schedule-range.ts";

// how tall an hour is on the time axis
const HOUR_PX = 48;
// a short Job is still tall enough to read its time and Client
const MIN_BLOCK_PX = 26;

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
 * The Schedule as a calendar: days as columns over a time axis, each Job a
 * block placed at its start and sized by its time on site. A week at a time,
 * or a day or three on a phone. Clicking a Job opens it; on a desktop,
 * Office Staff drag one to move it, confirming first.
 */
export function ScheduleScreen() {
  const days = useLoaderData({ from: "/office/schedule" });
  const { from, to } = scheduleRange(useSearch({ from: "/office/schedule" }));
  const navigate = useNavigate({ from: "/office/schedule" });
  const span = days.length as Span;
  const [moving, setMoving] = useState<{
    job: ScheduledJob;
    to: LocalDateTime;
  }>();

  const show = (span: Span, day: string) =>
    navigate({ search: rangeShowing(span, day) });
  // the day to keep in view when the span changes: today, if it's shown
  const anchor = today() >= from && today() <= to ? today() : from;

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Schedule</Heading>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="quiet"
            size="icon"
            aria-label={`Previous ${stepLabel[span]}`}
            onPress={() => show(span, addDays(from, -span))}
          >
            <ChevronLeft aria-hidden size={20} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => show(span, today())}
          >
            {span === 7 ? "This week" : "Today"}
          </Button>
          <Button
            variant="quiet"
            size="icon"
            aria-label={`Next ${stepLabel[span]}`}
            onPress={() => show(span, addDays(from, span))}
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
          onSelectionChange={(key) => show(Number(key) as Span, anchor)}
        >
          {SPANS.map((s) => (
            <SelectItem key={s} id={s} textValue={spanLabel[s]}>
              {spanLabel[s]}
            </SelectItem>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        <StatusBadge tone="warning">Unassigned</StatusBadge>
        <StatusBadge tone="info">Assigned</StatusBadge>
        <StatusBadge tone="success">Completed</StatusBadge>
        <StatusBadge tone="danger">No Access</StatusBadge>
        <span className="hidden md:inline">
          Drag a Job to move it, or open it to move it to any time.
        </span>
        <span className="md:hidden">Open a Job to move it.</span>
      </div>
      <Calendar days={days} onDrop={(job, to) => setMoving({ job, to })} />
      <Dialog
        title="Move this Job?"
        isOpen={moving !== undefined}
        onOpenChange={(isOpen) => !isOpen && setMoving(undefined)}
      >
        {({ close }) =>
          moving && (
            <ConfirmMove job={moving.job} to={moving.to} close={close} />
          )
        }
      </Dialog>
    </div>
  );
}

type Dragging = { job: ScheduledJob; grabbedAtPx: number };

function Calendar({
  days,
  onDrop,
}: {
  days: ScheduleDay[];
  onDrop: (job: ScheduledJob, to: LocalDateTime) => void;
}) {
  const axis = axisFor(days.flatMap((d) => d.jobs));
  const hours = Array.from(
    { length: axis.end - axis.start },
    (_, i) => axis.start + i,
  );
  // which Job is being dragged, and how far down it was grabbed, so it lands
  // where it's let go; state too, so days without room for it fade
  const dragging = useRef<Dragging>(undefined);
  const [draggedJob, setDraggedJob] = useState<ScheduledJob>();
  const wide = days.length === 7;

  const drop = (day: ScheduleDay, e: DragEvent<HTMLElement>) => {
    const grabbed = dragging.current;
    if (!grabbed || !hasRoomFor(day, grabbed.job)) return;
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
            <DayHeader day={day} />
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
              <DayJobs
                jobs={day.jobs}
                axisStart={axis.start}
                onDragStart={(grabbed) => {
                  dragging.current = grabbed;
                  setDraggedJob(grabbed.job);
                }}
                onDragEnd={() => {
                  dragging.current = undefined;
                  setDraggedJob(undefined);
                }}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// a day's Cleaner hours: booked, held for Reschedule Requests, and free,
// as a bar and in words; greyed when nobody is available
function DayHeader({ day }: { day: ScheduleDay }) {
  const total = Math.max(day.staffHours, day.bookedHours + day.heldHours, 1);
  const width = (hours: number) => `${Math.min((hours / total) * 100, 100)}%`;
  const isToday = day.date === today();
  const nobody = day.staffHours === 0;

  return (
    <header
      className={`flex flex-col gap-1 border-b border-border p-2 ${isToday ? "bg-info-subtle" : nobody ? "bg-surface-sunken" : ""}`}
    >
      <Heading level={2} size={4} className="text-sm">
        {formatDay(day.date)}
      </Heading>
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

function DayJobs({
  jobs,
  axisStart,
  onDragStart,
  onDragEnd,
}: {
  jobs: ScheduledJob[];
  axisStart: number;
  onDragStart: (grabbed: Dragging) => void;
  onDragEnd: () => void;
}) {
  const lanes = lanesFor(jobs);

  return jobs.map((job) => {
    const { start } = spanOf(job);
    const { lane, lanes: of } = lanes.get(job.id)!;
    const tone = toneOf(job);
    const crew = job.crew.map((c) => c.name).join(", ");
    return (
      <div
        key={job.id}
        draggable={job.movable}
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
        className={`absolute overflow-hidden rounded-md border-s-4 shadow-sm ${tone.block} ${job.movable ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{
          top: (start - axisStart) * HOUR_PX + 1,
          height: Math.max(job.hoursOnSite * HOUR_PX - 2, MIN_BLOCK_PX),
          left: `calc(${(lane / of) * 100}% + 2px)`,
          width: `calc(${100 / of}% - 4px)`,
        }}
      >
        <Link
          href={linkTo({
            to: "/office/jobs/$jobId",
            params: { jobId: job.id },
          })}
          className="flex h-full flex-col px-1.5 py-1 text-xs leading-tight font-normal text-fg no-underline"
        >
          <span className="truncate font-semibold">
            {formatTime(job.startsAt)} {job.client.name}
          </span>
          <span className="truncate">{tone.label}</span>
          <span className="truncate text-fg-muted">
            {crew || "No crew yet"}
          </span>
        </Link>
      </div>
    );
  });
}
