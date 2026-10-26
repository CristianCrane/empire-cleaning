// PROTOTYPE: throwaway, on the prototype-schedule-views branch only.
//
// Question: what's a more visual, friendlier way for the Office to see the
// whole Schedule and change it? Three variants of /office/schedule,
// switchable via ?variant=A|B|C (or ← →):
//   A  Week calendar: days as columns, a time axis, drag a Job to move it
//   B  Crew lanes: one day, a lane per Cleaner, drag a Job onto a lane to
//      offer them a place
//   C  Month + agenda: a month of capacity at a glance, tap a day for its
//      Jobs, "Move" a Job by tapping another day
// Reads the real Schedule (and each Job's Assignments). Every edit is an
// in-memory stub, listed in the "Prototype changes" panel: nothing is saved.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import type {
  AssignmentView,
  OfficeJob,
  ScheduleDay,
  ScheduledJob,
} from "@empire-cleaning/models";
import { Button, Card, Heading, Link, StatusBadge } from "@empire-cleaning/ui";
import { getJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import {
  addDays,
  addressOf,
  cleanTypeLabel,
  dayOfInstant,
  formatClock,
  formatDay,
  formatHours,
  mondayOf,
  timeOfDay,
  today,
} from "../format.ts";
import { scheduleRange } from "./schedule-range.ts";

const VARIANTS = [
  { key: "A", name: "Week calendar" },
  { key: "B", name: "Crew lanes" },
  { key: "C", name: "Month + agenda" },
];

// ---- shared data and stub edits (not layout) ----

type Edit =
  | { kind: "move"; jobId: string; label: string; date: string; time: string }
  | { kind: "offer"; jobId: string; label: string; staffName: string };

// each Job's places, from the Office's view of it
const useCrews = (jobs: ScheduledJob[]) => {
  const [crews, setCrews] = useState<Record<string, AssignmentView[]>>({});
  const ids = jobs.map((j) => j.id).join(",");
  useEffect(() => {
    let current = true;
    void Promise.all(
      jobs.map((j) => getJson<OfficeJob>(`/api/jobs/${j.id}`)),
    ).then((found) => {
      if (!current) return;
      setCrews(
        Object.fromEntries(
          found.map((j) => [
            j.id,
            j.assignments.filter((a) => a.status !== "released"),
          ]),
        ),
      );
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return crews;
};

// a Job as it would be with the stub edits applied
const withEdits = (job: ScheduledJob, edits: Edit[]) => {
  const move = edits.findLast(
    (e): e is Extract<Edit, { kind: "move" }> =>
      e.kind === "move" && e.jobId === job.id,
  );
  return move
    ? { ...job, date: move.date, time: move.time, moved: true }
    : {
        ...job,
        date: dayOfInstant(job.startsAt),
        time: timeOfDay(job.startsAt),
        moved: false,
      };
};

const hoursOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h! + m! / 60;
};
const toTime = (hours: number) =>
  `${String(Math.floor(hours)).padStart(2, "0")}:${hours % 1 >= 0.5 ? "30" : "00"}`;

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const jobTone = (job: ScheduledJob) =>
  job.status === "completed"
    ? "bg-success-subtle border-success-strong"
    : job.status === "no_access"
      ? "bg-danger-subtle border-danger-strong"
      : job.assignment === "assigned"
        ? "bg-info-subtle border-info-strong"
        : "bg-warning-subtle border-warning-strong";

// booked / held / free as a bar
function CapacityBar({ day }: { day: ScheduleDay }) {
  const total = Math.max(day.staffHours, day.bookedHours + day.heldHours, 1);
  const pct = (h: number) => `${Math.min((h / total) * 100, 100)}%`;
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      title={`${formatHours(day.bookedHours)} booked, ${formatHours(day.heldHours)} held, ${formatHours(day.freeHours)} free of ${formatHours(day.staffHours)}`}
    >
      <div
        className={day.freeHours < 0 ? "bg-danger" : "bg-primary"}
        style={{ width: pct(day.bookedHours) }}
      />
      <div
        className="bg-warning-strong opacity-60"
        style={{ width: pct(day.heldHours) }}
      />
    </div>
  );
}

function ChangesPanel({
  edits,
  onReset,
}: {
  edits: Edit[];
  onReset: () => void;
}) {
  return (
    <Card
      title="Prototype changes (not saved)"
      actions={
        edits.length > 0 && (
          <Button variant="quiet" size="sm" onPress={onReset}>
            Reset
          </Button>
        )
      }
    >
      {edits.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Nothing changed. Edits you make here are listed, never saved.
        </p>
      ) : (
        <ol className="list-decimal ps-5 text-sm">
          {edits.map((e, i) => (
            <li key={i}>
              {e.label}:{" "}
              {e.kind === "move"
                ? `move to ${formatDay(e.date)} ${formatClock(e.time)}`
                : `offer a place to ${e.staffName}`}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const jobLabel = (job: ScheduledJob) =>
  `${job.client.name}, ${formatDay(dayOfInstant(job.startsAt))} ${formatClock(timeOfDay(job.startsAt))}`;

export function ScheduleViewsPrototype({ days }: { days: ScheduleDay[] }) {
  const search = useSearch({ from: "/office/schedule" });
  const navigate = useNavigate({ from: "/office/schedule" });
  const [edits, setEdits] = useState<Edit[]>([]);
  const variant = search.variant ?? "A";
  const addEdit = (edit: Edit) => setEdits((all) => [...all, edit]);

  return (
    <div className="flex flex-col gap-4 pb-20">
      {variant === "A" && (
        <VariantA days={days} edits={edits} onEdit={addEdit} />
      )}
      {variant === "B" && (
        <VariantB days={days} edits={edits} onEdit={addEdit} />
      )}
      {variant === "C" && <VariantC edits={edits} onEdit={addEdit} />}
      <ChangesPanel edits={edits} onReset={() => setEdits([])} />
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        onChange={(key) =>
          navigate({ search: (prev) => ({ ...prev, variant: key }) })
        }
      />
    </div>
  );
}

type VariantProps = {
  days: ScheduleDay[];
  edits: Edit[];
  onEdit: (edit: Edit) => void;
};

// moves the shown week, keeping the variant
function WeekNav({ label }: { label: ReactNode }) {
  const search = useSearch({ from: "/office/schedule" });
  const navigate = useNavigate({ from: "/office/schedule" });
  const { from } = scheduleRange(search);
  const go = (monday: string) =>
    navigate({
      search: (prev) => ({ ...prev, from: monday, to: addDays(monday, 6) }),
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="quiet"
        aria-label="Previous week"
        onPress={() => go(addDays(mondayOf(from), -7))}
      >
        <ChevronLeft aria-hidden size={18} />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onPress={() => go(mondayOf(today()))}
      >
        This week
      </Button>
      <Button
        variant="quiet"
        aria-label="Next week"
        onPress={() => go(addDays(mondayOf(from), 7))}
      >
        <ChevronRight aria-hidden size={18} />
      </Button>
      <span className="font-semibold">{label}</span>
    </div>
  );
}

// ---- A: week calendar ----

const DAY_START = 7;
const DAY_END = 19;
const PX_PER_HOUR = 48;

function VariantA({ days, edits, onEdit }: VariantProps) {
  const crews = useCrews(days.flatMap((d) => d.jobs));
  const jobs = days.flatMap((d) => d.jobs).map((j) => withEdits(j, edits));
  const [dragging, setDragging] = useState<string>();
  const hours = Array.from(
    { length: DAY_END - DAY_START },
    (_, i) => DAY_START + i,
  );

  return (
    <>
      <Heading level={1}>Schedule</Heading>
      <WeekNav
        label={`${formatDay(days[0]!.date)} – ${formatDay(days.at(-1)!.date)}`}
      />
      <p className="text-sm text-fg-muted">
        Drag a Job to another day or time to move it. Bars show each day's
        Cleaner hours: booked, held for a move, and free.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <div
          className="grid min-w-[56rem]"
          style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}
        >
          <div className="sticky left-0 z-10 border-b border-border bg-surface" />
          {days.map((day) => (
            <div
              key={day.date}
              className={`flex flex-col gap-1 border-b border-s border-border p-2 ${day.date === today() ? "bg-info-subtle" : ""}`}
            >
              <span className="text-sm font-semibold">
                {formatDay(day.date)}
              </span>
              <CapacityBar day={day} />
              <span className="text-xs text-fg-muted">
                {day.staffHours === 0
                  ? "Nobody available"
                  : `${formatHours(day.freeHours)} free`}
              </span>
            </div>
          ))}

          <div className="sticky left-0 z-10 bg-surface">
            {hours.map((h) => (
              <div
                key={h}
                className="pe-2 text-end text-xs text-fg-muted"
                style={{ height: PX_PER_HOUR }}
              >
                {formatClock(toTime(h))}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div
              key={day.date}
              className={`relative border-s border-border ${day.staffHours === 0 ? "bg-surface-sunken" : ""}`}
              style={{ height: hours.length * PX_PER_HOUR }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const job = jobs.find((j) => j.id === dragging);
                if (!job) return;
                const y =
                  e.clientY - e.currentTarget.getBoundingClientRect().top;
                const at = Math.round((DAY_START + y / PX_PER_HOUR) * 2) / 2;
                onEdit({
                  kind: "move",
                  jobId: job.id,
                  label: jobLabel(job),
                  date: day.date,
                  time: toTime(Math.min(Math.max(at, DAY_START), DAY_END - 1)),
                });
              }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="border-t border-border/50"
                  style={{ height: PX_PER_HOUR }}
                />
              ))}
              {jobs
                .filter((j) => j.date === day.date)
                .map((job) => (
                  <div
                    key={job.id}
                    draggable={job.status === "booked"}
                    onDragStart={() => setDragging(job.id)}
                    className={`absolute inset-x-1 cursor-grab overflow-hidden rounded-md border-s-4 p-1 text-xs shadow-sm ${jobTone(job)} ${job.moved ? "outline-2 outline-dashed outline-primary" : ""}`}
                    style={{
                      top: (hoursOf(job.time) - DAY_START) * PX_PER_HOUR,
                      height: Math.max(job.hoursOnSite * PX_PER_HOUR, 28),
                    }}
                  >
                    <Link
                      href={linkTo({
                        to: "/office/jobs/$jobId",
                        params: { jobId: job.id },
                      })}
                    >
                      {formatClock(job.time)} {job.client.name}
                    </Link>
                    <div className="truncate text-fg-muted">
                      {cleanTypeLabel[job.cleanType]} ·{" "}
                      {(crews[job.id] ?? [])
                        .map((a) => initials(a.staff.name))
                        .join(" ") || "no crew"}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---- B: crew lanes, one day ----

const LANE_HOURS = Array.from(
  { length: DAY_END - DAY_START },
  (_, i) => DAY_START + i,
);

function VariantB({ days, edits, onEdit }: VariantProps) {
  const [date, setDate] = useState(
    days.find((d) => d.date === today())?.date ??
      days.find((d) => d.jobs.length > 0)?.date ??
      days[0]!.date,
  );
  const day = days.find((d) => d.date === date) ?? days[0]!;
  const crews = useCrews(day.jobs);
  const offers = edits.filter(
    (e): e is Extract<Edit, { kind: "offer" }> => e.kind === "offer",
  );
  const jobs = day.jobs.map((job) => ({
    ...job,
    crew: [
      ...(crews[job.id] ?? []).map((a) => ({
        name: a.staff.name,
        status: a.status,
      })),
      ...offers
        .filter((o) => o.jobId === job.id)
        .map((o) => ({ name: o.staffName, status: "proposed" as const })),
    ],
  }));
  const needsCrew = jobs.filter(
    (j) => j.status === "booked" && j.crew.length < j.crewSize,
  );
  const [dragging, setDragging] = useState<string>();
  const pct = (h: number) =>
    `${((h - DAY_START) / (DAY_END - DAY_START)) * 100}%`;

  return (
    <>
      <Heading level={1}>Crew board</Heading>
      <WeekNav label={formatDay(day.date)} />
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={d.date === date}
            onClick={() => setDate(d.date)}
            className={`flex min-w-24 flex-col gap-1 rounded-md border p-2 text-start text-sm ${d.date === date ? "border-primary bg-surface" : "border-border bg-surface-sunken"}`}
          >
            <span className="font-semibold">{formatDay(d.date)}</span>
            <CapacityBar day={d} />
            <span className="text-xs text-fg-muted">
              {d.jobs.length} {d.jobs.length === 1 ? "Job" : "Jobs"}
            </span>
          </button>
        ))}
      </div>

      <Card
        title="Needs a crew"
        description="Drag a Job onto a Cleaner's lane to offer them a place."
      >
        {needsCrew.length === 0 ? (
          <p className="text-sm text-fg-muted">Every place is offered.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {needsCrew.map((job) => (
              <div
                key={job.id}
                draggable
                onDragStart={() => setDragging(job.id)}
                className={`cursor-grab rounded-md border-s-4 px-3 py-2 text-sm ${jobTone(job)}`}
              >
                <strong>{formatClock(timeOfDay(job.startsAt))}</strong>{" "}
                {job.client.name} · {job.crewSize - job.crew.length} of{" "}
                {job.crewSize} open
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <div className="min-w-[48rem]">
          <div className="relative ms-40 h-6 border-b border-border">
            {LANE_HOURS.map((h) => (
              <span
                key={h}
                className="absolute text-xs text-fg-muted"
                style={{ left: pct(h) }}
              >
                {formatClock(toTime(h))}
              </span>
            ))}
          </div>
          {day.available.length === 0 && (
            <p className="p-4 text-sm text-fg-muted">
              No Cleaner is available on {formatDay(day.date)}.
            </p>
          )}
          {day.available.map((cleaner) => {
            const mine = jobs.filter((j) =>
              j.crew.some((c) => c.name === cleaner.name),
            );
            const load = mine.reduce((sum, j) => sum + j.hoursOnSite, 0);
            const over = load > cleaner.hours;
            return (
              <div
                key={cleaner.id}
                className="flex border-b border-border"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const job = jobs.find((j) => j.id === dragging);
                  if (!job || job.crew.some((c) => c.name === cleaner.name))
                    return;
                  onEdit({
                    kind: "offer",
                    jobId: job.id,
                    label: jobLabel(job),
                    staffName: cleaner.name,
                  });
                }}
              >
                <div className="flex w-40 shrink-0 flex-col justify-center gap-0.5 border-e border-border p-2">
                  <span className="truncate text-sm font-semibold">
                    {cleaner.name}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs ${over ? "text-danger" : "text-fg-muted"}`}
                  >
                    {over && <TriangleAlert size={12} aria-hidden />}
                    {formatHours(load)} of {formatHours(cleaner.hours)}
                  </span>
                </div>
                <div className="relative h-16 flex-1">
                  {LANE_HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute inset-y-0 border-s border-border/50"
                      style={{ left: pct(h) }}
                    />
                  ))}
                  {mine.map((job) => {
                    const start = hoursOf(timeOfDay(job.startsAt));
                    const status = job.crew.find(
                      (c) => c.name === cleaner.name,
                    )!.status;
                    return (
                      <div
                        key={job.id}
                        className={`absolute inset-y-2 overflow-hidden rounded-md border-s-4 px-2 text-xs ${jobTone(job)} ${status !== "confirmed" ? "border-dashed opacity-80" : ""}`}
                        style={{
                          left: pct(start),
                          width: `${(job.hoursOnSite / (DAY_END - DAY_START)) * 100}%`,
                        }}
                        title={`${job.client.name}, ${status}`}
                      >
                        <div className="truncate font-semibold">
                          {job.client.name}
                        </div>
                        <div className="truncate">
                          {status === "proposed"
                            ? "to offer"
                            : status === "offered"
                              ? "Offered"
                              : "Confirmed"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---- C: month + agenda ----

function VariantC({ edits, onEdit }: Omit<VariantProps, "days">) {
  // opens on the month of the week the Schedule was showing
  const { from } = scheduleRange(useSearch({ from: "/office/schedule" }));
  const [month, setMonth] = useState(() => from.slice(0, 7));
  const [month0, monthDays] = useMemo(() => {
    const first = `${month}-01`;
    const start = mondayOf(first);
    // six weeks covers any month
    return [first, Array.from({ length: 42 }, (_, i) => addDays(start, i))];
  }, [month]);
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [selected, setSelected] = useState(from);
  const [moving, setMoving] = useState<ScheduledJob>();

  useEffect(() => {
    let current = true;
    void getJson<ScheduleDay[]>(
      `/api/schedule?from=${monthDays[0]}&to=${monthDays.at(-1)}`,
    ).then((found) => current && setDays(found));
    return () => {
      current = false;
    };
  }, [monthDays]);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const allJobs = days.flatMap((d) => d.jobs).map((j) => withEdits(j, edits));
  const jobsOn = (date: string) => allJobs.filter((j) => j.date === date);
  const crews = useCrews(jobsOn(selected));
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month0}T00:00:00Z`));
  const shift = (by: number) => {
    const d = new Date(`${month0}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + by);
    setMonth(d.toISOString().slice(0, 7));
  };
  const hasRoom = (date: string, job: ScheduledJob) => {
    const day = byDate.get(date);
    return (
      !!day &&
      (day.freeHours >= job.labourHours || date === dayOfInstant(job.startsAt))
    );
  };

  return (
    <>
      <Heading level={1}>Schedule</Heading>
      <div className="flex items-center gap-2">
        <Button
          variant="quiet"
          aria-label="Previous month"
          onPress={() => shift(-1)}
        >
          <ChevronLeft aria-hidden size={18} />
        </Button>
        <span className="min-w-36 text-center font-semibold">{label}</span>
        <Button
          variant="quiet"
          aria-label="Next month"
          onPress={() => shift(1)}
        >
          <ChevronRight aria-hidden size={18} />
        </Button>
      </div>
      {moving && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-info-subtle p-3 text-sm">
          Moving <strong>{moving.client.name}</strong>: tap a day with room. It
          keeps its start time.
          <Button
            size="sm"
            variant="secondary"
            onPress={() => setMoving(undefined)}
          >
            Stop moving
          </Button>
        </div>
      )}
      <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:gap-4">
        <div className="grid grid-cols-7 gap-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-fg-muted"
            >
              {d}
            </div>
          ))}
          {monthDays.map((date) => {
            const day = byDate.get(date);
            const count = jobsOn(date).length;
            const unassigned = jobsOn(date).some(
              (j) => j.status === "booked" && j.assignment === "unassigned",
            );
            const target = moving && hasRoom(date, moving);
            const disabled = moving && !target;
            return (
              <button
                key={date}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (moving) {
                    onEdit({
                      kind: "move",
                      jobId: moving.id,
                      label: jobLabel(moving),
                      date,
                      time: timeOfDay(moving.startsAt),
                    });
                    setMoving(undefined);
                    setSelected(date);
                  } else setSelected(date);
                }}
                className={`flex min-h-16 flex-col gap-1 rounded-md border p-1 text-start text-xs disabled:opacity-30 ${date.slice(0, 7) !== month ? "opacity-50" : ""} ${date === selected ? "border-primary" : "border-border"} ${target ? "bg-info-subtle" : "bg-surface"}`}
              >
                <span
                  className={`font-semibold ${date === today() ? "text-primary" : ""}`}
                >
                  {Number(date.slice(8))}
                </span>
                {day && day.staffHours > 0 && <CapacityBar day={day} />}
                {count > 0 && (
                  <span className="flex items-center gap-1">
                    {count} {count === 1 ? "Job" : "Jobs"}
                    {unassigned && (
                      <span
                        className="size-2 rounded-full bg-warning-strong"
                        aria-label="unassigned"
                      />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Card
          title={formatDay(selected)}
          description={(() => {
            const day = byDate.get(selected);
            return day
              ? `${formatHours(day.staffHours)} available · ${formatHours(day.bookedHours)} booked · ${formatHours(day.freeHours)} free`
              : undefined;
          })()}
        >
          {jobsOn(selected).length === 0 ? (
            <p className="text-sm text-fg-muted">No Jobs.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {jobsOn(selected)
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((job) => (
                  <li key={job.id} className="flex flex-col gap-1 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={linkTo({
                          to: "/office/jobs/$jobId",
                          params: { jobId: job.id },
                        })}
                      >
                        {formatClock(job.time)} · {job.client.name}
                      </Link>
                      {job.moved ? (
                        <StatusBadge tone="info">Moved (stub)</StatusBadge>
                      ) : job.assignment === "assigned" ? (
                        <StatusBadge tone="info">Assigned</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Unassigned</StatusBadge>
                      )}
                    </div>
                    <span className="text-sm text-fg-muted">
                      {addressOf(job.property)} ·{" "}
                      {cleanTypeLabel[job.cleanType]} ·{" "}
                      {formatHours(job.hoursOnSite)} on site
                    </span>
                    <span className="text-sm">
                      Crew:{" "}
                      {(crews[job.id] ?? [])
                        .map((a) => `${a.staff.name} (${a.status})`)
                        .join(", ") || "nobody yet"}
                    </span>
                    {job.status === "booked" && (
                      <div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setMoving(job)}
                        >
                          Move
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
