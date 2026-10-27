import type { ScheduleDay, ScheduledJob } from "@empire-cleaning/models";
import { timeOfDay } from "./format.ts";

// "09:30" -> 9.5
export const hoursOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h! + m! / 60;
};

// 9.5 -> "09:30", to the nearest minute
export const timeAt = (hours: number) => {
  const minutes = Math.round(hours * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

// a dropped Job starts on the quarter hour
export const SNAP_HOURS = 0.25;
export const snap = (hours: number) =>
  Math.round(hours / SNAP_HOURS) * SNAP_HOURS;

// a Job's place on the time axis: when it starts and ends, in hours since
// midnight, New York
export const spanOf = (job: ScheduledJob) => {
  const start = hoursOf(timeOfDay(job.startsAt));
  return { start, end: start + job.hoursOnSite };
};

// the working day the axis shows, widened to whole hours to fit any Job
// outside it, or anything else to be placed on it
export const axisFor = (
  jobs: ScheduledJob[],
  more: { start: number; end: number }[] = [],
) => {
  let start = 7;
  let end = 19;
  for (const span of [...jobs.map(spanOf), ...more]) {
    start = Math.min(start, Math.floor(span.start));
    end = Math.max(end, Math.ceil(span.end));
  }
  return { start, end: Math.min(end, 24) };
};

// a block on the time axis: from when to when it's drawn, in hours
export type Block = { id: string; start: number; end: number };

/**
 * Side by side, as a calendar lays out events that overlap: each block's
 * lane, counting from 0, and how many lanes its group of overlapping blocks
 * needs. Blocks overlap by where they're drawn, so a short Job drawn taller
 * than its time on site doesn't cover the next.
 */
export const lanesFor = (blocks: Block[]) => {
  const placed = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);

  let group: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const { id, lane } of group) {
      placed.set(id, { lane, lanes: laneEnds.length });
    }
    group = [];
    laneEnds = [];
  };

  for (const { id, start, end } of sorted) {
    // overlapping nothing so far: a group of its own
    if (start >= groupEnd) {
      close();
      groupEnd = end;
    }
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    group.push({ id, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  close();
  return placed;
};

// a clean's crew, to find room for on the Schedule; a booked Job or Site
// Visit being moved gives its id, so it isn't counted against itself
export type Crew = { crewSize: number; jobId?: string; siteVisitId?: string };

/**
 * Whether a crew is free for a clean starting at `time` on a day, by the
 * headcount rule the server keeps (roomOn): the most crews at work at once
 * during its time on site, Jobs, the new times held for Reschedule Requests
 * and Site Visits by Cleaners (a crew of one each) all, plus its own, are no
 * more than the day's available Cleaners. Says how many Cleaners those crews
 * take, of how many.
 */
export const crewAt = (
  day: ScheduleDay,
  time: string,
  hoursOnSite: number,
  { crewSize, jobId, siteVisitId }: Crew,
) => {
  const spans = [
    ...day.jobs.filter((job) => job.id !== jobId),
    ...day.held.filter((held) => held.jobId !== jobId),
  ]
    .map((other) => ({
      startsAt: other.startsAt,
      hoursOnSite: other.labourHours / other.crewSize,
      crewSize: other.crewSize,
    }))
    .concat(
      day.siteVisits
        .filter((visit) => visit.takesRoom && visit.id !== siteVisitId)
        .map((visit) => ({
          startsAt: visit.startsAt,
          hoursOnSite: visit.minutes / 60,
          crewSize: 1,
        })),
    )
    .map((other) => {
      const start = hoursOf(timeOfDay(other.startsAt));
      return {
        start,
        end: start + other.hoursOnSite,
        crewSize: other.crewSize,
      };
    });
  const start = hoursOf(time);
  const end = start + hoursOnSite;
  const during = spans.filter((s) => s.start < end && s.end > start);
  // the count only goes up when a crew starts
  const starts = [
    start,
    ...during.map((s) => s.start).filter((t) => t > start),
  ];
  const busy = Math.max(
    ...starts.map((t) =>
      during
        .filter((s) => s.start <= t && s.end > t)
        .reduce((sum, s) => sum + s.crewSize, 0),
    ),
  );
  const cleaners = day.available.length;
  return { busy, cleaners, hasCrew: busy + crewSize <= cleaners };
};

/**
 * Which blocks to draw when no more than `maxLanes` fit side by side: those
 * in `keep` always, then the rest in `order`, each drawn if it still fits,
 * and the others left to list instead. A narrow column shows what it can
 * read rather than slivers of everything.
 */
export const fitLanes = (
  blocks: Block[],
  maxLanes: number,
  {
    keep = [],
    order,
  }: { keep?: string[]; order: (a: Block, b: Block) => number },
) => {
  const shown = blocks.filter((b) => keep.includes(b.id));
  const hidden: Block[] = [];
  const widest = (placed: Map<string, { lanes: number }>) =>
    Math.max(0, ...[...placed.values()].map((p) => p.lanes));
  for (const block of blocks.filter((b) => !keep.includes(b.id)).sort(order)) {
    if (widest(lanesFor([...shown, block])) <= maxLanes) shown.push(block);
    else hidden.push(block);
  }
  return { shown, hidden };
};
