import type { ScheduledJob } from "@empire-cleaning/models";
import { timeOfDay } from "../format.ts";

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

/**
 * Side by side, as a calendar lays out events that overlap: each Job's lane,
 * counting from 0, and how many lanes its group of overlapping Jobs needs.
 */
export const lanesFor = (jobs: ScheduledJob[]) => {
  const placed = new Map<string, { lane: number; lanes: number }>();
  const sorted = jobs
    .map((job) => ({ job, ...spanOf(job) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

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

  for (const { job, start, end } of sorted) {
    // overlapping nothing so far: a group of its own
    if (start >= groupEnd) {
      close();
      groupEnd = end;
    }
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    group.push({ id: job.id, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  close();
  return placed;
};
