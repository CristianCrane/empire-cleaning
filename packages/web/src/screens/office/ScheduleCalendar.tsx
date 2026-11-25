import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  asClean,
  atTime,
  PICK_MINUTES,
  PICK_TIMES,
  roomOn,
  whyVisitCantGo,
  type DayTimes,
  type LocalDateTime,
  type ScheduleDay,
  type ScheduledJob,
  type ScheduledSiteVisit,
  formats,
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
  Line,
} from "@empire-cleaning/ui";
import { linkTo, type AppHref } from "../../links.ts";
import {
  HOUR_PX,
  onAxis,
  PickSlot,
  TimeGrid,
  type TimePickerProps,
} from "../CalendarGrid.tsx";
import { JobBadge } from "../JobBadges.tsx";
import {
  crewOf,
  dayOfInstant,
  formatHours,
  formatMinutes,
  jobLabelOf,
  shortClientName,
  timeOfDay,
  today,
} from "../format.ts";
import { SiteVisitIcon } from "../icons.ts";
import {
  axisFor,
  fitLanes,
  hoursOf,
  lanesFor,
  type Block,
  snap,
  SNAP_HOURS,
  spanOf,
  timeAt,
} from "../schedule-layout.ts";

const { formatClock, formatDay, formatTime } = formats.en;

// a short Job is still tall enough to read its Client
const MIN_BLOCK_PX = 22;
// a block's line of text (text-xs, leading-tight), and how many fit whole
// inside its padding (py-1). With room for one, a block is compact: that
// line, centred, the rest read out only
const LINE_PX = 15;
const wholeLines = (height: number) =>
  Math.max(1, Math.floor((height - 8) / LINE_PX));
const PICK_HOURS = PICK_MINUTES / 60;
// in the week view, a lane narrower than this can't show a Job's Client, so
// the Jobs that don't fit are listed behind "+N more" instead
const MIN_LANE_PX = 60;
// the time axis's labels, and how narrow the week's days can get before the
// calendar scrolls sideways (TimeGrid)
const AXIS_PX = 56;
const WEEK_DAY_MIN_PX = 104;

// a Job's block: its colours, by the tone of how it reads (jobLabelOf)
const blockOf = {
  success: "border-success-strong bg-success-subtle",
  danger: "border-danger-strong bg-danger-subtle",
  info: "border-info-strong bg-info-subtle",
  warning: "border-warning-strong bg-warning-subtle",
  neutral: "border-neutral-strong bg-neutral-subtle",
} as const;

// a dragged block's outline where it would land: its colours, its edge dashed
// all round so it shows over its own block and others, its fill see-through
const outlineOf = {
  success: "border-success-strong bg-success-subtle/60",
  danger: "border-danger-strong bg-danger-subtle/60",
  info: "border-info-strong bg-info-subtle/60",
  warning: "border-warning-strong bg-warning-subtle/60",
  neutral: "border-neutral-strong bg-neutral-subtle/60",
} as const;

// a Job's state as a mark: its icon, in its tone's strong colour
const markOf = {
  success: "text-success-strong",
  danger: "text-danger-strong",
  info: "text-info-strong",
  warning: "text-warning-strong",
  neutral: "text-neutral-strong",
} as const;

const toneOf = (job: Pick<ScheduledJob, "status" | "assignment">) => {
  const { label, tone, icon } = jobLabelOf(job);
  return { label, tone, icon, block: blockOf[tone], mark: markOf[tone] };
};

// a block's mark: an icon in its tone's strong colour, on the block and in
// the key alike. A Job's is its state's (a Staffed Job, the usual case, has
// none); a Site Visit's is its own
type Mark = { icon: LucideIcon | undefined; mark: string };

function StateMark({
  icon: Icon,
  mark,
  className = "",
}: Mark & { className?: string }) {
  return Icon ? (
    <Icon aria-hidden className={`size-3 shrink-0 ${mark} ${className}`} />
  ) : null;
}

// a Site Visit's mark: its own icon, in the neutral colour of its block
const visitMark: Mark = { icon: SiteVisitIcon, mark: markOf.neutral };

// an entry in the Schedule's key, drawn as a block is: its colours and
// edge, then its mark and name
function KeyEntry({
  colours,
  children,
}: {
  colours: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border-s-4 px-1.5 py-0.5 text-xs font-semibold ${colours}`}
    >
      {children}
    </span>
  );
}

// a Job's state in the key
export function JobKey({
  job,
}: {
  job: Pick<ScheduledJob, "status" | "assignment">;
}) {
  const tone = toneOf(job);
  return (
    <KeyEntry colours={tone.block}>
      <StateMark {...tone} />
      {tone.label}
    </KeyEntry>
  );
}

// a Site Visit's block in the key: its neutral colours, its mark, its name
export function VisitKey() {
  return (
    <KeyEntry colours={blockOf.neutral}>
      <StateMark {...visitMark} />
      Site visit
    </KeyEntry>
  );
}

// a Site Visit's place on the time axis
const visitSpanOf = (visit: ScheduledSiteVisit) => {
  const start = hoursOf(timeOfDay(visit.startsAt));
  return { start, end: start + visit.minutes / 60 };
};

// a time without a crew free for the clean: striped, so it reads as
// blocked even before it's pointed at
const NO_CREW =
  "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-danger-subtle)_6px_12px)]";

// what's dragged to a new time on the Schedule: a Job, or a Site Visit
export type Moving =
  | { kind: "job"; job: ScheduledJob }
  | { kind: "visit"; visit: ScheduledSiteVisit };

// what the calendar draws of what's dragged: its id, when it starts, its time
// on site, its block's tone (a Site Visit's is neutral) and its Client
const factsOf = (moving: Moving) =>
  moving.kind === "job"
    ? {
        id: moving.job.id,
        startsAt: moving.job.startsAt,
        hoursOnSite: moving.job.hoursOnSite,
        tone: toneOf(moving.job).tone,
        client: moving.job.client,
      }
    : {
        id: moving.visit.id,
        startsAt: moving.visit.startsAt,
        hoursOnSite: moving.visit.minutes / 60,
        tone: "neutral" as const,
        client: moving.visit.client,
      };

// whether what's dragged can go at a time on a day, by the server's own
// rules: a Job's room (roomOn: the day's hours and a crew free then), a Site
// Visit's (whyVisitCantGo: not yet passed, its visitor's hours, or Office
// Staff, a crew free, and busy with nothing else then); both end by midnight
const canGoAt = (day: ScheduleDay, moving: Moving, time: string) => {
  const startsAt = atTime(day.date, time);
  if (moving.kind === "job") {
    return roomOn(day, { ...asClean(moving.job), startsAt }).hasRoom;
  }
  const { visit } = moving;
  return (
    visit.visitor !== null &&
    whyVisitCantGo(
      day,
      { startsAt, minutes: visit.minutes, siteVisitId: visit.id },
      visit.visitor,
      new Date(),
    ) === null
  );
};

// a clean placed on the calendar before it's booked there: when it starts,
// its time on site and what it's called
export type Proposed = {
  start: LocalDateTime;
  hoursOnSite: number;
  label: string;
};

type Dragging = { moving: Moving; grabbedAtPx: number };

/**
 * The Schedule as a calendar: days as columns over a time axis, each Job and
 * Site Visit a block placed at its start and sized by its time on site.
 *
 * On the Schedule itself (onDrop), clicking a Job or Site Visit opens it and
 * dragging one moves it. To choose a time instead (onPick), the blocks are
 * only there to see, and clicking a free half hour picks it, or with
 * limits, one of the start times on offer on a day that has them; a
 * proposed clean is drawn where it would go. Given the times without a
 * crew free for the clean (noCrew, from the server), they're marked: they
 * can still be picked, for a Quote the Office may add a Cleaner for, but
 * the server refuses to book there.
 *
 * To only look and open (opensJobs, as on the Today screen), clicking a Job
 * or Site Visit opens it and nothing moves.
 */
export function ScheduleCalendar({
  days,
  onDrop,
  onPick,
  limits,
  proposed,
  noCrew,
  opensJobs = false,
}: {
  days: ScheduleDay[];
  onDrop?: (moving: Moving, to: LocalDateTime) => void;
  opensJobs?: boolean;
  onPick?: (at: LocalDateTime) => void;
  limits?: TimePickerProps["limits"];
  proposed?: Proposed;
  noCrew?: DayTimes[];
}) {
  // whether blocks open on click, and whether they can be dragged to move
  const opens = onDrop !== undefined || opensJobs;
  const proposedStart = proposed && hoursOf(proposed.start.time);
  const axis = axisFor(
    days.flatMap((d) => d.jobs),
    [
      ...days.flatMap((d) => d.siteVisits.map(visitSpanOf)),
      ...(proposedStart === undefined
        ? []
        : [
            {
              start: proposedStart,
              end: proposedStart + proposed!.hoursOnSite,
            },
          ]),
    ],
  );
  // the times to pick from on a day, on the axis: those on offer there, or
  // every one a picker offers
  const timesOn = (date: string) =>
    (limits
      ? (limits.find((d) => d.date === date)?.times ?? [])
      : PICK_TIMES
    ).filter((t) => hoursOf(t) >= axis.start && hoursOf(t) < axis.end);
  const isOpen = (date: string) =>
    !limits || limits.some((d) => d.date === date);
  // whether the clean's crew would be free at a time
  const hasCrew = (day: ScheduleDay, time: string) =>
    !noCrew?.find((d) => d.date === day.date)?.times.includes(time);
  // what's being dragged, and how far down it was grabbed, so it lands where
  // it's let go; state too, so days where it can go at no time fade
  const dragging = useRef<Dragging>(undefined);
  const [dragged, setDragged] = useState<Moving>();
  // where it would land if let go now, drawn there; kept as it is while the
  // pointer stays in the same quarter hour, so only a move redraws
  const [landing, setLanding] = useState<LocalDateTime>();
  const landAt = (to: LocalDateTime | undefined) =>
    setLanding((was) =>
      was?.date === to?.date && was?.time === to?.time ? was : to,
    );
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

  // when a block dragged over a day's body would start there: its top where
  // the pointer is less how far down it was grabbed, snapped to the quarter
  // hour and kept on the axis
  const landingOf = (e: DragEvent<HTMLElement>, grabbed: Dragging) => {
    const top =
      e.clientY -
      e.currentTarget.getBoundingClientRect().top -
      grabbed.grabbedAtPx;
    return timeAt(
      Math.min(
        Math.max(snap(axis.start + top / HOUR_PX), axis.start),
        axis.end - SNAP_HOURS,
      ),
    );
  };

  // whether what's dragged can go at no time it can land at on a day
  const noRoomAllDay = (day: ScheduleDay, moving: Moving) => {
    for (let at = axis.start; at <= axis.end - SNAP_HOURS; at += SNAP_HOURS) {
      if (canGoAt(day, moving, timeAt(at))) return false;
    }
    return true;
  };

  const drop = (day: ScheduleDay, e: DragEvent<HTMLElement>) => {
    const grabbed = dragging.current;
    if (!onDrop || !grabbed) return;
    const to = { date: day.date, time: landingOf(e, grabbed) };
    if (!canGoAt(day, grabbed.moving, to.time)) return;
    e.preventDefault();
    const { startsAt } = factsOf(grabbed.moving);
    if (to.date !== dayOfInstant(startsAt) || to.time !== timeOfDay(startsAt)) {
      onDrop(grabbed.moving, to);
    }
  };

  return (
    <div ref={frame}>
      <TimeGrid
        axis={axis}
        columns={days.map((day) => {
          const layout = layoutDay(
            day.jobs,
            day.siteVisits,
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
              // a day without room fades, but not under the outline, whose
              // red says so
              (dragged &&
                landing?.date !== day.date &&
                noRoomAllDay(day, dragged)) ||
              !isOpen(day.date)
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
                      interactive={opens}
                    />
                  )
                }
                marker={
                  proposed?.start.date === day.date ? "Starts" : undefined
                }
              />
            ),
            bodyLabel: `Jobs on ${formatDay(day.date)}`,
            bodyProps: {
              className: day.staffHours === 0 ? "bg-surface-sunken" : "",
              onDragOver: (e) => {
                const grabbed = dragging.current;
                if (!grabbed) return;
                const time = landingOf(e, grabbed);
                if (canGoAt(day, grabbed.moving, time)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
                landAt({ date: day.date, time });
              },
              // leaving the day, not just moving onto a block within it
              onDragLeave: (e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                  landAt(undefined);
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
                        label={
                          crewFree ? undefined : "not enough cleaners free"
                        }
                        onPick={onPick}
                      >
                        {/* every half hour shows its time when pointed at; only
                        some on offer, they always do */}
                        <span
                          className={`text-fg-muted ${limits ? "" : "opacity-0 group-hover:opacity-100"}`}
                        >
                          {formatClock(time)}
                          {!crewFree && " · not enough cleaners free"}
                        </span>
                      </PickSlot>
                    );
                  })}
                <DayJobs
                  layout={layout}
                  axisStart={axis.start}
                  narrow={maxLanes !== Infinity}
                  interactive={opens}
                  movable={onDrop !== undefined}
                  onDragStart={(grabbed) => {
                    dragging.current = grabbed;
                    setDragged(grabbed.moving);
                  }}
                  onDragEnd={() => {
                    dragging.current = undefined;
                    setDragged(undefined);
                    landAt(undefined);
                  }}
                />
                {dragged && landing?.date === day.date && (
                  <Landing
                    moving={dragged}
                    time={landing.time}
                    axis={axis}
                    taken={canGoAt(day, dragged, landing.time)}
                  />
                )}
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
  const title = `More jobs on ${formatDay(date)}`;

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
                return (
                  <ListItem
                    key={job.id}
                    id={job.id}
                    textValue={`${formatTime(job.startsAt)} ${shortClientName(job.client)}`}
                    title={`${formatTime(job.startsAt)} · ${shortClientName(job.client)}`}
                    description={crewOf(job.crew)}
                    end={<JobBadge job={job} />}
                  />
                );
              })}
            </List>
            <Actions>
              <Button variant="quiet" onPress={close}>
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
        {nobody && day.bookedHours === 0 ? (
          "Nobody working"
        ) : (
          // each figure kept whole on its line, not "7 h 30 min" over "free"
          <Line
            parts={[
              `${formatHours(day.bookedHours)} booked`,
              day.heldHours > 0 && `${formatHours(day.heldHours)} held`,
              day.freeHours < 0
                ? `${formatHours(-day.freeHours)} over`
                : `${formatHours(day.freeHours)} free`,
            ].map(
              (part) =>
                part && (
                  <span key={part} className="whitespace-nowrap">
                    {part}
                  </span>
                ),
            )}
          />
        )}
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
 * A day's blocks: each Job's, each Site Visit's, and the proposed clean's;
 * side by side where they'd overlap, so Jobs at the same time with
 * different crews all show. When more overlap than `maxLanes` fit, the
 * proposed clean and Site Visits always keep their lanes, then Unassigned
 * Jobs are drawn first, as the ones to act on, then the earliest; the rest
 * are hidden, earliest first, to list instead.
 */
const layoutDay = (
  jobs: ScheduledJob[],
  visits: ScheduledSiteVisit[],
  proposed: ProposedOnDay | undefined,
  maxLanes: number,
) => {
  const blocks = [
    ...jobs.map((job) => drawn(job.id, spanOf(job).start, job.hoursOnSite)),
    ...visits.map((visit) =>
      drawn(visit.id, visitSpanOf(visit).start, visit.minutes / 60),
    ),
  ];
  const proposedBlock =
    proposed && drawn(PROPOSED, hoursOf(proposed.time), proposed.hoursOnSite);
  const unassigned = new Set(
    jobs
      .filter(
        (job) => job.status === "booked" && job.assignment === "unassigned",
      )
      .map((j) => j.id),
  );
  const { shown, hidden } = fitLanes(
    proposedBlock ? [...blocks, proposedBlock] : blocks,
    maxLanes,
    {
      keep: [PROPOSED, ...visits.map((v) => v.id)],
      order: (a, b) =>
        Number(unassigned.has(b.id)) - Number(unassigned.has(a.id)) ||
        a.start - b.start,
    },
  );
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const visitById = new Map(visits.map((visit) => [visit.id, visit]));
  return {
    lanes: lanesFor(shown),
    jobs: shown.flatMap((block) => {
      const job = byId.get(block.id);
      return job ? [{ job, block }] : [];
    }),
    visits: shown.flatMap((block) => {
      const visit = visitById.get(block.id);
      return visit ? [{ visit, block }] : [];
    }),
    hidden: hidden
      .sort((a, b) => a.start - b.start)
      .flatMap((block) => byId.get(block.id) ?? []),
    proposed: proposed &&
      proposedBlock && { ...proposed, block: proposedBlock },
  };
};

// a day's blocks, laid out. On the Schedule, a Job or a Site Visit is a link
// that can be dragged; otherwise only to see, letting clicks through to the time under it.
// In the week's narrow days, a block keeps less room at its sides
function DayJobs({
  layout: { lanes, jobs, visits, proposed },
  axisStart,
  narrow,
  interactive,
  movable,
  onDragStart,
  onDragEnd,
}: {
  layout: ReturnType<typeof layoutDay>;
  axisStart: number;
  narrow: boolean;
  interactive: boolean;
  movable: boolean;
  onDragStart: (grabbed: Dragging) => void;
  onDragEnd: () => void;
}) {
  // a drag's start: the pointer carries the whole block, grabbed where it was
  // grabbed. It starts on the link inside, whose own picture is only its words
  const startDrag = (moving: Moving) => (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", factsOf(moving).id);
    const box = e.currentTarget.getBoundingClientRect();
    const grabbedAtPx = e.clientY - box.top;
    e.dataTransfer.setDragImage(
      e.currentTarget,
      e.clientX - box.left,
      grabbedAtPx,
    );
    onDragStart({ moving, grabbedAtPx });
  };
  const place = (block: Block) => {
    const { lane, lanes: of } = lanes.get(block.id)!;
    return onAxis(block.start, block.end - block.start, axisStart, {
      lane,
      of,
    });
  };

  return (
    <>
      {jobs.map(({ job, block }) => {
        const style = place(block);
        const tone = toneOf(job);
        // too short for more than a line: the Client's name and the state's
        // mark, the rest unseen but still read out
        const compact = wholeLines(style.height) < 2;
        return (
          <ScheduleBlock
            key={job.id}
            moving={{ kind: "job", job }}
            href={linkTo({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            })}
            colours={tone.block}
            style={style}
            compact={compact}
            narrow={narrow}
            interactive={interactive}
            draggable={movable && job.movable}
            onDragStart={startDrag}
            onDragEnd={onDragEnd}
          >
            <BlockName compact={compact} mark={tone}>
              <span className="sr-only">{formatTime(job.startsAt)} </span>
              {shortClientName(job.client)}
            </BlockName>
            <BlockTime compact={compact}>{formatTime(job.startsAt)}</BlockTime>
            <span className="sr-only">, {tone.label}</span>
            {/* a name to a line, so the lines that fit whole are whole
                names, never one cut short */}
            {job.crew.map((member) => (
              <BlockLine key={member.id} compact={compact} muted>
                <span className="sr-only">, </span>
                {member.name}
              </BlockLine>
            ))}
          </ScheduleBlock>
        );
      })}
      {visits.map(({ visit, block }) => {
        const style = place(block);
        const compact = wholeLines(style.height) < 2;
        return (
          <ScheduleBlock
            key={visit.id}
            moving={{ kind: "visit", visit }}
            href={linkTo({
              to: "/office/site-visits/$visitId",
              params: { visitId: visit.id },
            })}
            colours={blockOf.neutral}
            style={style}
            compact={compact}
            narrow={narrow}
            interactive={interactive}
            draggable={movable && visit.movable}
            onDragStart={startDrag}
            onDragEnd={onDragEnd}
          >
            <BlockName compact={compact} mark={visitMark}>
              <span className="sr-only">{formatTime(visit.startsAt)} </span>
              {shortClientName(visit.client)}
            </BlockName>
            <BlockTime compact={compact}>
              {formatTime(visit.startsAt)}
            </BlockTime>
            <BlockLine compact={compact}>
              <span className="sr-only">, </span>
              <Line parts={["Site visit", formatMinutes(visit.minutes)]} />
            </BlockLine>
            {visit.visitor && (
              <BlockLine compact={compact} muted>
                <span className="sr-only">, </span>
                {visit.visitor.name}
              </BlockLine>
            )}
          </ScheduleBlock>
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

// a Job's or Site Visit's block on the calendar, at its place on the axis in
// its colours: on the Schedule a link to its page that can be dragged,
// otherwise only to see, letting clicks through to the time under it
function ScheduleBlock({
  moving,
  href,
  colours,
  style,
  compact,
  narrow,
  interactive,
  draggable,
  onDragStart,
  onDragEnd,
  children,
}: {
  moving: Moving;
  href: AppHref;
  colours: string;
  style: CSSProperties;
  compact: boolean;
  narrow: boolean;
  interactive: boolean;
  draggable: boolean;
  onDragStart: (moving: Moving) => (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  children: ReactNode;
}) {
  const inside = `flex h-full flex-col ${narrow ? "px-1" : "px-1.5"} text-xs leading-tight font-normal text-fg no-underline ${compact ? "justify-center" : "py-1"}`;
  // only the lines that fit whole, each drawn whole or not at all: a line
  // that would run past the last whole line, a wrapped name's second half
  // too, moves to a column of its own past the block's edge, which isn't
  // drawn. What isn't drawn is still read out, as a screen reader reads it
  const lines = compact ? (
    children
  ) : (
    <span
      className="flex flex-col flex-wrap content-start overflow-hidden [&>*]:w-full [&>*]:shrink-0"
      style={{ height: wholeLines(Number(style.height)) * LINE_PX }}
    >
      {children}
    </span>
  );
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart(moving)}
      onDragEnd={onDragEnd}
      className={`absolute overflow-hidden rounded-md border-s-4 shadow-sm ${colours} ${interactive ? (draggable ? "cursor-grab active:cursor-grabbing" : "") : "pointer-events-none"}`}
      style={style}
    >
      {interactive ? (
        <Link href={href} className={inside}>
          {lines}
        </Link>
      ) : (
        <div className={inside}>{lines}</div>
      )}
    </div>
  );
}

// a block's Client, its mark beside it: where it has the height, the name
// wraps rather than being cut, as it's what tells the block apart; on one
// line, cut
function BlockName({
  compact,
  mark,
  children,
}: {
  compact: boolean;
  mark: Mark;
  children: ReactNode;
}) {
  return (
    <span
      className={`flex gap-1 font-semibold ${compact ? "items-center" : "items-start"}`}
    >
      <StateMark {...mark} className={compact ? "" : "mt-px"} />
      <span
        className={`min-w-0 ${compact ? "truncate" : "[overflow-wrap:anywhere]"}`}
      >
        {children}
      </span>
    </span>
  );
}

// a block's start, shown under its name where there's room; read out with
// the name instead, as a screen reader can't see the block's place
function BlockTime({
  compact,
  children,
}: {
  compact: boolean;
  children: ReactNode;
}) {
  return compact ? null : (
    <span aria-hidden className="[overflow-wrap:anywhere] text-fg-muted">
      {children}
    </span>
  );
}

// a block's line under its name and time: wrapped where the lane is
// narrow rather than cut short, as the block draws only the lines that fit
// whole; on a block of one line, read out only
function BlockLine({
  compact,
  muted = false,
  children,
}: {
  compact: boolean;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={
        compact
          ? "sr-only"
          : `[overflow-wrap:anywhere] ${muted ? "text-fg-muted" : ""}`
      }
    >
      {children}
    </span>
  );
}

// a Job or Site Visit being dragged, drawn faintly in its own colours the
// width of the day where it would land if let go now, at its size on the
// calendar, cut off at the axis's end; in red where it can't go
function Landing({
  moving,
  time,
  axis,
  taken,
}: {
  moving: Moving;
  time: string;
  axis: { start: number; end: number };
  taken: boolean;
}) {
  const { id, hoursOnSite, tone, client } = factsOf(moving);
  const block = drawn(id, hoursOf(time), hoursOnSite);
  return (
    <div
      className={`pointer-events-none absolute overflow-hidden rounded-md border-2 border-dashed px-1.5 py-1 text-xs leading-tight font-semibold ${outlineOf[taken ? tone : "danger"]}`}
      style={onAxis(
        block.start,
        Math.min(block.end, axis.end) - block.start,
        axis.start,
      )}
    >
      {formatClock(time)} {shortClientName(client)}
    </div>
  );
}
