import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import type {
  LocalDateTime,
  ScheduleDay,
  ScheduledJob,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Link,
  List,
  ListItem,
  StatusBadge,
  type StatusTone,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  HOUR_PX,
  PickSlot,
  TimeGrid,
  type TimePickerProps,
} from "../CalendarGrid.tsx";
import {
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
  crewAt,
  fitLanes,
  hoursOf,
  lanesFor,
  type Block,
  type Crew,
  snap,
  SNAP_HOURS,
  spanOf,
  timeAt,
} from "../schedule-layout.ts";
import { daysIn } from "../schedule-range.ts";

// a short Job is still tall enough to read its time and Client
const MIN_BLOCK_PX = 22;
// shorter than this, a Job's block has room for only that one line
const COMPACT_PX = 44;
// a time is picked to the half hour, then fine-tuned in the time field
const PICK_HOURS = 0.5;
// in the week view, a lane narrower than this can't show a Job's time, so
// the Jobs that don't fit are listed behind "+N more" instead
const MIN_LANE_PX = 60;
// the time axis's labels, and how narrow the week's days can get before the
// calendar scrolls sideways (TimeGrid)
const AXIS_PX = 56;
const WEEK_DAY_MIN_PX = 104;

// a Job's colour and its words for it: how it turned out, or whether its
// crew is Confirmed
const toneOf = (
  job: ScheduledJob,
): { label: string; tone: StatusTone; block: string } =>
  job.status === "completed"
    ? {
        label: "Completed",
        tone: "success",
        block: "border-success-strong bg-success-subtle",
      }
    : job.status === "no_access"
      ? {
          label: "No Access",
          tone: "danger",
          block: "border-danger-strong bg-danger-subtle",
        }
      : job.assignment === "assigned"
        ? {
            label: "Assigned",
            tone: "info",
            block: "border-info-strong bg-info-subtle",
          }
        : {
            label: "Unassigned",
            tone: "warning",
            block: "border-warning-strong bg-warning-subtle",
          };

const crewOf = (job: ScheduledJob) =>
  job.crew.map((c) => c.name).join(", ") || "No crew yet";

// a time without a crew free for the clean: striped, so it reads as
// blocked even before it's pointed at
const NO_CREW =
  "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-danger-subtle)_6px_12px)]";

// whether a Job can move onto a day: its own day always has room for it
const hasRoomFor = (day: ScheduleDay, job: ScheduledJob) =>
  day.date === dayOfInstant(job.startsAt) ||
  Math.round(day.freeHours * 100) >= Math.round(job.labourHours * 100);

// a clean placed on the calendar before it's booked there: when it starts,
// its time on site, what it's called, and for a Service Plan, how many
// weeks apart its cleans are
export type Proposed = {
  start: LocalDateTime;
  hoursOnSite: number;
  label: string;
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
 * see, and clicking a free half hour picks it, or with limits, one of the
 * start times on offer on a day that has them; a proposed clean is drawn
 * where it would go. Given the clean's crew, times without a crew free for
 * it are marked: they can still be picked, for a Quote the Office may add a
 * Cleaner for, but the server refuses to book there.
 */
export function ScheduleCalendar({
  days,
  onDrop,
  onPick,
  limits,
  proposed,
  crew,
}: {
  days: ScheduleDay[];
  onDrop?: (job: ScheduledJob, to: LocalDateTime) => void;
  onPick?: (at: LocalDateTime) => void;
  limits?: TimePickerProps["limits"];
  proposed?: Proposed;
  crew?: Crew & { hoursOnSite: number };
}) {
  const proposedStart = proposed && hoursOf(proposed.start.time);
  const axis = axisFor(
    days.flatMap((d) => d.jobs),
    proposedStart === undefined
      ? []
      : [{ start: proposedStart, end: proposedStart + proposed!.hoursOnSite }],
  );
  // the times to pick from on a day: those on offer there, or every half hour
  const everyHalfHour = Array.from(
    { length: (axis.end - axis.start) / PICK_HOURS },
    (_, i) => timeAt(axis.start + i * PICK_HOURS),
  );
  const timesOn = (date: string) =>
    (limits
      ? (limits.find((d) => d.date === date)?.times ?? [])
      : everyHalfHour
    ).filter((t) => hoursOf(t) >= axis.start && hoursOf(t) < axis.end);
  const isOpen = (date: string) =>
    !limits || limits.some((d) => d.date === date);
  // whether the clean's crew would be free at a time
  const hasCrew = (day: ScheduleDay, time: string) =>
    !crew || crewAt(day, time, crew.hoursOnSite, crew).hasCrew;
  // which Job is being dragged, and how far down it was grabbed, so it lands
  // where it's let go; state too, so days without room for it fade
  const dragging = useRef<Dragging>(undefined);
  const [draggedJob, setDraggedJob] = useState<ScheduledJob>();
  // how many Jobs fit side by side in a day: in the week view, as many as
  // its width can show; with fewer days, every one
  const frame = useRef<HTMLDivElement>(null);
  const width = useWidth(frame);
  const maxLanes =
    days.length === 7 && width !== undefined
      ? Math.max(
          1,
          Math.floor(
            Math.max((width - AXIS_PX) / 7, WEEK_DAY_MIN_PX) / MIN_LANE_PX,
          ),
        )
      : Infinity;

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
    <div ref={frame}>
      <TimeGrid
        axis={axis}
        columns={days.map((day) => {
          const layout = layoutDay(
            day.jobs,
            proposed?.start.date === day.date
              ? {
                  time: proposed.start.time,
                  hoursOnSite: proposed.hoursOnSite,
                  label: proposed.label,
                }
              : undefined,
            maxLanes,
          );
          return {
            date: day.date,
            className:
              (draggedJob && !hasRoomFor(day, draggedJob)) || !isOpen(day.date)
                ? "opacity-40"
                : "",
            header: (
              <DayHeader
                day={day}
                more={
                  layout.hidden.length > 0 && (
                    <MoreJobs
                      date={day.date}
                      jobs={layout.hidden}
                      interactive={onDrop !== undefined}
                    />
                  )
                }
                marker={
                  proposed?.start.date === day.date
                    ? "Starts"
                    : repeatsOn(proposed, day.date)
                      ? "Repeats"
                      : undefined
                }
              />
            ),
            bodyLabel: `Jobs on ${formatDay(day.date)}`,
            bodyProps: {
              className: day.staffHours === 0 ? "bg-surface-sunken" : "",
              onDragOver: (e) => {
                const grabbed = dragging.current;
                if (grabbed && hasRoomFor(day, grabbed.job)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              },
              onDrop: (e) => drop(day, e),
            },
            body: (
              <>
                {onPick &&
                  isOpen(day.date) &&
                  timesOn(day.date).map((time) => {
                    const crewFree = hasCrew(day, time);
                    return (
                      <PickSlot
                        key={time}
                        at={{ date: day.date, time }}
                        axisStart={axis.start}
                        hours={PICK_HOURS}
                        className={crewFree ? "" : NO_CREW}
                        label={crewFree ? undefined : "no crew free"}
                        onPick={onPick}
                      >
                        {/* every half hour shows its time when pointed at; only
                        some on offer, they always do */}
                        <span
                          className={`text-fg-muted ${limits ? "" : "opacity-0 group-hover:opacity-100"}`}
                        >
                          {formatClock(time)}
                          {!crewFree && " · no crew free"}
                        </span>
                      </PickSlot>
                    );
                  })}
                <DayJobs
                  layout={layout}
                  axisStart={axis.start}
                  narrow={maxLanes !== Infinity}
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
              </>
            ),
          };
        })}
      />
    </div>
  );
}

// how wide an element is, as it changes
const useWidth = (ref: RefObject<HTMLElement | null>) => {
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

// the Jobs on a day that didn't fit side by side, behind a button that
// lists them; on the Schedule itself, each opens its Job
function MoreJobs({
  date,
  jobs,
  interactive,
}: {
  date: string;
  jobs: ScheduledJob[];
  interactive: boolean;
}) {
  const navigate = useNavigate();
  const title = `More Jobs on ${formatDay(date)}`;

  return (
    <DialogTrigger>
      <Button variant="secondary" size="sm" className="self-start">
        +{jobs.length} more
      </Button>
      <Dialog title={title}>
        {({ close }) => (
          <>
            <List
              aria-label={title}
              onAction={
                interactive
                  ? (id) =>
                      navigate({
                        to: "/office/jobs/$jobId",
                        params: { jobId: String(id) },
                      })
                  : undefined
              }
            >
              {jobs.map((job) => {
                const tone = toneOf(job);
                return (
                  <ListItem
                    key={job.id}
                    id={job.id}
                    textValue={`${formatTime(job.startsAt)} ${job.client.name}`}
                    title={`${formatTime(job.startsAt)} · ${job.client.name}`}
                    description={crewOf(job)}
                    end={
                      <StatusBadge tone={tone.tone}>{tone.label}</StatusBadge>
                    }
                  />
                );
              })}
            </List>
            <Actions>
              <Button variant="secondary" onPress={close}>
                Close
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// a day's Cleaner hours: booked, held for Reschedule Requests, and free,
// as a bar and in words; greyed when nobody is available
function DayHeader({
  day,
  marker,
  more,
}: {
  day: ScheduleDay;
  marker?: string;
  more?: ReactNode;
}) {
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
      {more}
    </header>
  );
}

// where a block is drawn: from its start for its time on site, but never
// shorter than a line of words
const drawn = (id: string, start: number, hoursOnSite: number): Block => ({
  id,
  start,
  end: start + Math.max(hoursOnSite, (MIN_BLOCK_PX + 2) / HOUR_PX),
});

const PROPOSED = "proposed";

type ProposedOnDay = { time: string; hoursOnSite: number; label: string };

/**
 * A day's blocks: each Job's, and the proposed clean's; side by side where
 * they'd overlap, so Jobs at the same time with different crews all show.
 * When more overlap than `maxLanes` fit, the proposed clean always keeps
 * its lane, then Unassigned Jobs are drawn first, as the ones to act on,
 * then the earliest; the rest are hidden, earliest first, to list instead.
 */
const layoutDay = (
  jobs: ScheduledJob[],
  proposed: ProposedOnDay | undefined,
  maxLanes: number,
) => {
  const blocks = jobs.map((job) =>
    drawn(job.id, spanOf(job).start, job.hoursOnSite),
  );
  const proposedBlock =
    proposed && drawn(PROPOSED, hoursOf(proposed.time), proposed.hoursOnSite);
  const unassigned = new Set(
    jobs.filter((job) => toneOf(job).label === "Unassigned").map((j) => j.id),
  );
  const { shown, hidden } = fitLanes(
    proposedBlock ? [...blocks, proposedBlock] : blocks,
    maxLanes,
    {
      keep: [PROPOSED],
      order: (a, b) =>
        Number(unassigned.has(b.id)) - Number(unassigned.has(a.id)) ||
        a.start - b.start,
    },
  );
  const byId = new Map(jobs.map((job) => [job.id, job]));
  return {
    lanes: lanesFor(shown),
    jobs: shown.flatMap((block) => {
      const job = byId.get(block.id);
      return job ? [{ job, block }] : [];
    }),
    hidden: hidden
      .sort((a, b) => a.start - b.start)
      .map((block) => byId.get(block.id)!),
    proposed: proposed &&
      proposedBlock && { ...proposed, block: proposedBlock },
  };
};

// a day's blocks, laid out. On the Schedule, a Job is a link that can be
// dragged; otherwise only to see, letting clicks through to the time under it.
// In the week's narrow days, a Job's time and Client each get a line
function DayJobs({
  layout: { lanes, jobs, proposed },
  axisStart,
  narrow,
  interactive,
  onDragStart,
  onDragEnd,
}: {
  layout: ReturnType<typeof layoutDay>;
  axisStart: number;
  narrow: boolean;
  interactive: boolean;
  onDragStart: (grabbed: Dragging) => void;
  onDragEnd: () => void;
}) {
  const place = (block: Block) => {
    const { lane, lanes: of } = lanes.get(block.id)!;
    return {
      top: (block.start - axisStart) * HOUR_PX + 1,
      height: (block.end - block.start) * HOUR_PX - 2,
      left: `calc(${(lane / of) * 100}% + 2px)`,
      width: `calc(${100 / of}% - 4px)`,
    };
  };

  return (
    <>
      {jobs.map(({ job, block }) => {
        const style = place(block);
        const tone = toneOf(job);
        const crew = crewOf(job);
        // too short for three lines: the time and Client, the rest unseen
        // but still read out
        const compact = style.height < COMPACT_PX;
        const words = compact ? (
          <span className="truncate font-semibold">
            {formatTime(job.startsAt)} {job.client.name}
            <span className="sr-only">
              , {tone.label}, {crew}
            </span>
          </span>
        ) : (
          <>
            {narrow ? (
              <>
                <span className="truncate font-semibold">
                  {formatTime(job.startsAt)}
                </span>{" "}
                <span className="truncate font-semibold">
                  {job.client.name}
                </span>
              </>
            ) : (
              <span className="truncate font-semibold">
                {formatTime(job.startsAt)} {job.client.name}
              </span>
            )}
            <span className="truncate">{tone.label}</span>
            <span className="truncate text-fg-muted">{crew}</span>
          </>
        );
        const inside = `flex h-full flex-col ${narrow ? "px-1" : "px-1.5"} text-xs leading-tight font-normal text-fg no-underline ${compact ? "justify-center" : "py-1"}`;
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
            style={style}
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
      })}
      {proposed && (
        <div
          className="pointer-events-none absolute overflow-hidden rounded-md border-2 border-dashed border-primary bg-primary/15 px-1.5 py-0.5 text-xs leading-tight font-semibold"
          style={place(proposed.block)}
        >
          {formatClock(proposed.time)} {proposed.label}
        </div>
      )}
    </>
  );
}
