// PROTOTYPE: throwaway. The Draft quote's Proposed time, with the Schedule
// in the section instead of behind "Pick from the schedule" (the user,
// 2026-11-23: "why not just show the calendar right there on the section").
// Made-up data, a busy week, at /prototype/proposed-time?layout=A..C&case=1..4
// (no sign-in), in the Office's real frame and FormPage. ↑/↓ switch
// layouts, ←/→ cases.
//   A  the day's schedule in the card: a strip of the week, then one day
//      of the Schedule, its Jobs and the open times marked beside them; the
//      date and time fields behind "Type a date and time". (Three days, and
//      the week under the form, were drawn first and crushed every Job's
//      name: see the report.)
//   B  open times: the strip, then the day's start times that have room,
//      as the Client's own picker reads; no time grid
//   C  B with the day's cleaners: a row each across the day, their Jobs on
//      it, the picked clean a band down every row
// Cases: 1 a time picked, with room · 2 a new draft, nothing picked ·
// 3 a time picked without enough cleaners · 4 a plan, Mondays and Thursdays
// Lives only on prototype-proposed-time.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  parseDate,
  parseTime,
  type CalendarDate,
  type Time,
} from "@internationalized/date";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Keyboard,
  Send,
  Trash2,
} from "lucide-react";
import {
  addDays,
  daysIn,
  formats,
  PICK_TIMES,
  type DayTimes,
  type LocalDateTime,
  type ScheduleDay,
  type ScheduledJob,
} from "@empire-cleaning/models";
import {
  AppLayout,
  Button,
  Checkbox,
  DatePicker,
  FieldRow,
  Fold,
  FormPage,
  FormPart,
  type NavItem,
  Notice,
  NumberField,
  Segment,
  SegmentedControl,
  Select,
  SelectItem,
  showToast,
  TimeField,
  useWide,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { navFor } from "../AreaLayout.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { PriceHead } from "../QuoteParts.tsx";
import { timeOfField } from "../format.ts";
import { hoursOf } from "../schedule-layout.ts";
import { rangeShowing } from "../schedule-range.ts";
import { ScheduleCalendar } from "./ScheduleCalendar.tsx";

const { formatDay, formatClock, weekdayName } = formats.en;

const say = (what: string) => () =>
  showToast({ title: `Prototype: "${what}" does nothing here`, tone: "info" });

// ---- made-up data: a busy week, the same every week ----

const CLEANERS = [
  "Ana Lima",
  "Bea Ortiz",
  "Carla Ruiz",
  "Diego Paz",
  "Eva Soto",
];
// each weekday's working hours (Monday first), [from, to]
const HOURS: Record<string, [number, number] | undefined>[] = [
  {
    "Ana Lima": [8, 17],
    "Bea Ortiz": [8, 17],
    "Carla Ruiz": [9, 18],
    "Diego Paz": [9, 19],
    "Eva Soto": [8, 16],
  },
  {
    "Ana Lima": [8, 17],
    "Bea Ortiz": [8, 17],
    "Carla Ruiz": [9, 18],
    "Diego Paz": [9, 19],
    "Eva Soto": [8, 16],
  },
  {
    "Ana Lima": [8, 17],
    "Bea Ortiz": [8, 17],
    "Carla Ruiz": [9, 18],
    "Diego Paz": [9, 19],
  },
  {
    "Ana Lima": [8, 17],
    "Bea Ortiz": [8, 17],
    "Carla Ruiz": [9, 18],
    "Diego Paz": [9, 19],
    "Eva Soto": [8, 16],
  },
  {
    "Ana Lima": [8, 17],
    "Bea Ortiz": [8, 17],
    "Carla Ruiz": [9, 18],
    "Diego Paz": [9, 19],
    "Eva Soto": [8, 16],
  },
  { "Ana Lima": [9, 14], "Diego Paz": [9, 15] },
  {},
];
// each weekday's Jobs: start, hours on site, crew, client, street
type JobSeed = [number, number, string[], string, string];
const JOBS: JobSeed[][] = [
  [
    [8, 2.5, ["Ana Lima", "Bea Ortiz"], "Okafor", "18 Elm St"],
    [9, 3, ["Carla Ruiz", "Eva Soto"], "Brennan", "402 Park Ave"],
    [11, 2, ["Ana Lima", "Bea Ortiz"], "Nguyen", "77 Grove St"],
    [13, 3, ["Carla Ruiz", "Diego Paz"], "Delgado", "9 Linden Pl"],
    [14.5, 1.5, ["Ana Lima", "Bea Ortiz"], "Hoffman", "310 Ash Rd"],
  ],
  [
    [
      8.5,
      3,
      ["Ana Lima", "Bea Ortiz", "Eva Soto"],
      "Castellanos",
      "41-12 Austin St",
    ],
    [10, 2.5, ["Carla Ruiz", "Diego Paz"], "Patel", "5 Birch Ln"],
    [12, 2, ["Ana Lima", "Bea Ortiz"], "Moreau", "88 Cedar Ave"],
    [14, 2, ["Carla Ruiz", "Diego Paz"], "Kowalski", "120 Pine St"],
  ],
  [
    [8, 4, ["Ana Lima", "Bea Ortiz"], "Ferreira", "61 Maple Dr"],
    [9.5, 2, ["Carla Ruiz"], "Tanaka", "14 Oak Ct"],
    [
      12.5,
      3,
      ["Ana Lima", "Bea Ortiz", "Carla Ruiz"],
      "Rossi",
      "230 Spruce St",
    ],
    [15, 2, [], "Abernathy-Lindqvist", "3 Willow Way"],
  ],
  [
    [8, 2, ["Ana Lima", "Eva Soto"], "Murphy", "55 Holly St"],
    [10, 3, ["Ana Lima", "Bea Ortiz"], "Haddad", "19 Poplar Ave"],
    [11, 2.5, ["Carla Ruiz", "Diego Paz"], "Johansson", "700 River Rd"],
    [14, 2, ["Bea Ortiz", "Carla Ruiz"], "Svoboda", "28 Laurel St"],
  ],
  [
    [8, 3, ["Ana Lima", "Bea Ortiz"], "Whitfield", "12 Chestnut St"],
    [8.5, 3, ["Carla Ruiz", "Eva Soto"], "Amari", "450 Hill Rd"],
    [11.5, 2, ["Ana Lima", "Bea Ortiz"], "Lindgren", "6 Fir Pl"],
    [12, 3, ["Diego Paz", "Carla Ruiz"], "O'Neill", "81 Beech St"],
    [14, 2, ["Ana Lima", "Bea Ortiz"], "Vasquez", "33 Alder Ave"],
  ],
  [[9, 3, ["Ana Lima", "Diego Paz"], "Greenberg", "240 Dogwood Ln"]],
  [],
];

const clock = (h: number) =>
  `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
// New York's offset in winter
const instant = (date: string, h: number) => `${date}T${clock(h)}:00-05:00`;
const weekdayIndex = (date: string) =>
  (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;

const scheduleDay = (date: string): ScheduleDay => {
  const i = weekdayIndex(date);
  const hours = HOURS[i]!;
  const jobs: ScheduledJob[] = JOBS[i]!.map(
    ([start, onSite, crew, client, street], n) => {
      const crewSize = Math.max(crew.length, 2);
      return {
        id: `${date}-${n}`,
        startsAt: instant(date, start),
        serviceName: "Standard Clean",
        status: "booked",
        labourHours: onSite * crewSize,
        crewSize,
        hoursOnSite: onSite,
        client: { id: client, name: client, businessName: null },
        property: { id: street, street, unit: null, postcode: "11375" },
        assignment: crew.length >= crewSize ? "assigned" : "unassigned",
        crew: crew.map((name) => ({ id: name, name })),
        movable: true,
      };
    },
  );
  const staffHours = Object.values(hours).reduce(
    (sum, h) => sum + (h ? h[1] - h[0] : 0),
    0,
  );
  const bookedHours = jobs.reduce((sum, j) => sum + j.labourHours, 0);
  return {
    date,
    staffHours,
    bookedHours,
    heldHours: 0,
    freeHours: staffHours - bookedHours,
    available: CLEANERS.flatMap((name) => {
      const h = hours[name];
      return h ? [{ id: name, name, hours: h[1] - h[0] }] : [];
    }),
    jobs,
    held: [],
    siteVisits: [],
  };
};

// the server's answer, made up: a start has room when enough cleaners work
// the whole clean and have no Job overlapping it
const freeCrewAt = (date: string, start: number, hoursOnSite: number) => {
  const i = weekdayIndex(date);
  const end = start + hoursOnSite;
  return CLEANERS.filter((name) => {
    const h = HOURS[i]![name];
    if (!h || h[0] > start || h[1] < end) return false;
    return !JOBS[i]!.some(
      ([s, len, crew]) => crew.includes(name) && s < end && s + len > start,
    );
  }).length;
};
const hasRoom = (at: LocalDateTime, crewSize: number, hoursOnSite: number) =>
  freeCrewAt(at.date, hoursOf(at.time), hoursOnSite) >= crewSize;
const noCrewOn = (
  dates: string[],
  crewSize: number,
  hoursOnSite: number,
): DayTimes[] =>
  dates.map((date) => ({
    date,
    times: PICK_TIMES.filter(
      (time) => !hasRoom({ date, time }, crewSize, hoursOnSite),
    ),
  }));
const openTimes = (date: string, crewSize: number, hoursOnSite: number) =>
  PICK_TIMES.filter(
    (time) =>
      hoursOf(time) >= 7 && hasRoom({ date, time }, crewSize, hoursOnSite),
  );

const datesFrom = (from: string, to: string) =>
  Array.from({ length: daysIn(from, to) }, (_, i) => addDays(from, i));
const mondayOf = (date: string) => addDays(date, -weekdayIndex(date));
const FIRST = "2026-11-30";
const firstOpen = () => {
  for (let i = 0; i < 28; i++) {
    const date = addDays(FIRST, i);
    if (openTimes(date, CREW, ON_SITE).length > 0) return date;
  }
  return FIRST;
};

// the clean: a Standard Clean, two cleaners, 2.5 hours on site
const CREW = 2;
const ON_SITE = 2.5;

// ---- the cases ----

type Case = {
  name: string;
  plan?: boolean;
  start?: LocalDateTime;
  days?: { title: string; start: LocalDateTime }[];
};
const CASES: Record<string, Case> = {
  "1": {
    name: "a time picked, with room",
    start: { date: "2026-12-01", time: "14:00" },
  },
  "2": { name: "a new draft, nothing picked" },
  "3": {
    name: "picked, not enough cleaners",
    start: { date: "2026-12-04", time: "11:30" },
  },
  "4": {
    name: "a plan, Tuesdays and Thursdays",
    plan: true,
    days: [
      { title: "Tuesdays", start: { date: "2026-12-01", time: "14:00" } },
      { title: "Thursdays", start: { date: "2026-12-03", time: "13:30" } },
    ],
  },
};
const LAYOUTS = [
  { key: "A", name: "the day's schedule in the card" },
  { key: "B", name: "open times, no grid" },
  { key: "C", name: "open times, with the day's cleaners" },
];

// ---- the parts every layout shares ----

const toField = (at?: LocalDateTime) => ({
  date: at ? parseDate(at.date) : null,
  time: at ? parseTime(at.time) : null,
});

// the room line, the server's answer, a time on screen
function RoomLine({ at, title }: { at: LocalDateTime; title?: string }) {
  if (hasRoom(at, CREW, ON_SITE))
    return (
      <p className="flex items-center gap-2 text-sm text-success-strong">
        <CircleCheck aria-hidden size={16} className="shrink-0" />
        {title ? `${title}: ` : ""}
        {formatDay(at.date)}, {formatClock(at.time)} has room for it.
      </p>
    );
  return (
    <Notice tone="danger">
      {title ? `${title}: ` : ""}Not enough cleaners are free then. Pick another
      time, or give a cleaner more working hours that day.
    </Notice>
  );
}

// the keyboard's way, and a time off the half hour: the fields, behind a line
function TypedTime({
  at,
  onPick,
  label = "Type a date and time",
}: {
  at?: LocalDateTime;
  onPick: (at: LocalDateTime) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { date, time } = toField(at);
  const set = (d: CalendarDate | null, t: Time | null) => {
    if (d && t) onPick({ date: d.toString(), time: timeOfField(t) });
  };
  return open ? (
    <FieldRow packed>
      <DatePicker label="Date" value={date} onChange={(d) => set(d, time)} />
      <TimeField
        label="Start time"
        value={time}
        onChange={(t) => set(date, t)}
      />
    </FieldRow>
  ) : (
    <Button
      variant="text"
      size="sm"
      className="self-start"
      onPress={() => setOpen(true)}
    >
      <Keyboard aria-hidden size={16} />
      {label}
    </Button>
  );
}

// a strip of the week: each day, how booked it is, and whether the clean
// has room at any time; a phone's way through the days, and B's
function DayStrip({
  day,
  chosen: chosenDay,
  onDay,
}: {
  day: string;
  // the day of the time picked, if there is one
  chosen?: string;
  onDay: (day: string) => void;
}) {
  const monday = mondayOf(day);
  const dates = datesFrom(monday, addDays(monday, 6));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="quiet"
          size="icon"
          aria-label="Previous week"
          onPress={() => onDay(addDays(day, -7))}
        >
          <ChevronLeft aria-hidden size={20} />
        </Button>
        <p className="font-semibold" aria-live="polite">
          {formatDay(monday)} – {formatDay(addDays(monday, 6))}
        </p>
        <Button
          variant="quiet"
          size="icon"
          aria-label="Next week"
          onPress={() => onDay(addDays(day, 7))}
        >
          <ChevronRight aria-hidden size={20} />
        </Button>
      </div>
      <div role="group" aria-label="Days" className="grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const room = openTimes(date, CREW, ON_SITE).length > 0;
          const chosen = date === chosenDay;
          const viewed = date === day;
          return (
            <button
              key={date}
              type="button"
              aria-current={viewed ? "date" : undefined}
              aria-label={`${formatDay(date)}${room ? "" : ", full"}${chosen ? ", picked" : ""}`}
              onClick={() => onDay(date)}
              className={`flex min-h-touch flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 ${
                chosen
                  ? "bg-primary text-primary-fg"
                  : room
                    ? "hover:bg-surface-sunken"
                    : "text-fg-muted"
              } ${viewed && !chosen ? "ring-2 ring-primary ring-inset" : ""}`}
            >
              <span className="text-xs">{weekdayName(date).slice(0, 3)}</span>
              <span className="text-lg leading-none font-semibold">
                {Number(date.slice(8))}
              </span>
              <span aria-hidden className="h-4 text-xs">
                {room ? "" : "Full"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- A and C: the Schedule itself, in the section ----

function OnTheSchedule({
  span,
  picks,
  active,
  onPick,
  phone,
}: {
  // how many days from md: 3 in the card, 7 under the form from xl
  span: 1 | 3 | 7;
  // what's placed, a plan's weekdays each
  picks: { title: string; start?: LocalDateTime; everyDays?: number }[];
  // which one a press places
  active: number;
  onPick: (at: LocalDateTime) => void;
  phone: boolean;
}) {
  const placing = picks[active]!;
  void span;
  void phone;
  // a day at a time at every width, under the week's strip: three days in
  // the card's 42rem crushed every Job's name to a letter a line
  const first = placing.start?.date ?? firstOpen();
  const [range, setRange] = useState(() => rangeShowing(1, first));
  const dates = datesFrom(range.from, range.to);
  const days = dates.map(scheduleDay);
  const calendar = (
    <ScheduleCalendar
      days={days}
      noCrew={noCrewOn(dates, CREW, ON_SITE)}
      ghostHours={ON_SITE}
      marksOpen
      proposed={picks.flatMap((p) =>
        p.start
          ? [
              {
                start: p.start,
                hoursOnSite: ON_SITE,
                label: p.title,
                everyDays: p.everyDays,
              },
            ]
          : [],
      )}
      onPick={onPick}
    />
  );
  return (
    <div className="flex flex-col gap-3">
      <DayStrip
        day={range.from}
        chosen={placing.start?.date}
        onDay={(day) => setRange(rangeShowing(1, day))}
      />
      <p className="text-sm text-fg-muted">Marked times have room for it.</p>
      {calendar}
    </div>
  );
}

// ---- B: the day's open times ----

// C: the day's cleaners, each a row across the day: when they work, their
// Jobs, and the picked clean as a band down every row, so who's free for it
// shows
function WhoIsFree({ day, start }: { day: string; start?: LocalDateTime }) {
  const i = weekdayIndex(day);
  const hours = HOURS[i]!;
  const working = CLEANERS.filter((name) => hours[name]);
  if (working.length === 0)
    return (
      <p className="text-sm text-fg-muted">
        Nobody's working {formatDay(day)}.
      </p>
    );
  const from = 7;
  const to = 19;
  const at = (h: number) => `${((h - from) / (to - from)) * 100}%`;
  const span = (a: number, b: number) => ({
    left: at(a),
    width: `${((b - a) / (to - from)) * 100}%`,
  });
  const band = start?.date === day ? hoursOf(start.time) : undefined;
  return (
    <div
      role="group"
      aria-label={`Cleaners on ${formatDay(day)}`}
      className="flex flex-col gap-1 text-xs"
    >
      <div className="grid grid-cols-[3.5rem_1fr] items-end">
        <span />
        <div className="relative h-4 text-fg-muted">
          {[8, 12, 16].map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2"
              style={{ left: at(h) }}
            >
              {h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}
            </span>
          ))}
        </div>
      </div>
      <div className="relative grid grid-cols-[3.5rem_1fr] gap-y-1">
        {working.map((name) => {
          const [a, b] = hours[name]!;
          return (
            <div key={name} className="contents">
              <span className="self-center truncate font-semibold">
                {name.split(" ")[0]}
              </span>
              <div className="relative h-7 rounded-sm bg-surface-sunken">
                <div
                  className="absolute inset-y-0 bg-surface ring-1 ring-border ring-inset"
                  style={span(a, b)}
                />
                {JOBS[i]!.filter(([, , crew]) => crew.includes(name)).map(
                  ([s0, len, , client]) => (
                    <div
                      key={client}
                      className="absolute inset-y-0.5 overflow-hidden rounded-sm border-s-2 border-info-strong bg-info-subtle px-1 leading-6 whitespace-nowrap"
                      style={span(s0, s0 + len)}
                    >
                      {client}
                    </div>
                  ),
                )}
              </div>
            </div>
          );
        })}
        {band !== undefined && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 rounded-md border-2 border-dashed border-primary bg-primary/10"
            style={{
              left: `calc(3.5rem + (100% - 3.5rem) * ${(band - from) / (to - from)})`,
              width: `calc((100% - 3.5rem) * ${ON_SITE / (to - from)})`,
            }}
          />
        )}
      </div>
    </div>
  );
}

function OpenTimes({
  start,
  onPick,
  title,
  withCrew = false,
}: {
  start?: LocalDateTime;
  onPick: (at: LocalDateTime) => void;
  title?: string;
  // C: the day's cleaners above its times
  withCrew?: boolean;
}) {
  const [day, setDay] = useState(start?.date ?? firstOpen());
  const times = openTimes(day, CREW, ON_SITE);
  const groups = [
    { name: "Morning", times: times.filter((t) => hoursOf(t) < 12) },
    { name: "Afternoon", times: times.filter((t) => hoursOf(t) >= 12) },
  ].filter((g) => g.times.length > 0);
  return (
    <div className="flex flex-col gap-4">
      <DayStrip day={day} chosen={start?.date} onDay={setDay} />
      {withCrew && <WhoIsFree day={day} start={start} />}
      {groups.length === 0 ? (
        <p className="text-sm text-fg-muted">
          No time on {formatDay(day)} has {CREW} cleaners free for {ON_SITE}{" "}
          hours.
        </p>
      ) : (
        groups.map((group) => (
          <div
            key={group.name}
            role="group"
            aria-label={`${group.name} on ${formatDay(day)}${title ? `, ${title}` : ""}`}
            className="flex flex-col gap-2"
          >
            <span className="text-sm font-semibold">{group.name}</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {group.times.map((t) => {
                const chosen = start?.date === day && start.time === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => onPick({ date: day, time: t })}
                    className={`min-h-touch rounded-md font-semibold tabular-nums ${
                      chosen
                        ? "bg-primary text-primary-fg"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {formatClock(t)}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---- the Draft ----

function Aside({ plan }: { plan: boolean }) {
  return plan ? (
    <div className="flex flex-col gap-4">
      {["Tuesdays", "Thursdays"].map((title) => (
        <div key={title} className="flex flex-col gap-2">
          <span className="font-semibold">{title}</span>
          <PriceHead totalCents={16566} taxCents={1351} perClean />
        </div>
      ))}
      <div className="border-t border-border pt-3">
        <Fold label="How it's worked out">
          <p className="text-sm">
            The plan discount comes off the one-off price.
          </p>
        </Fold>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      <span className="font-semibold">Standard Clean</span>
      <PriceHead totalCents={19489} taxCents={1589} />
      <Fold label="How it's worked out">
        <p className="text-sm">From your prices, version 7.</p>
      </Fold>
      <div className="border-t border-border pt-3 text-sm">
        <Fold label="Also offered: Deep Clean $299.41">
          <p className="text-fg-muted">Shown to the client as recommended.</p>
        </Fold>
      </div>
    </div>
  );
}

function ServicePart() {
  return (
    <FormPart title="Service">
      <Select label="Type" className="sm:w-80" defaultSelectedKey="standard">
        <SelectItem id="standard">Standard Clean</SelectItem>
        <SelectItem id="deep">Deep Clean</SelectItem>
      </Select>
      <Checkbox>Set the Standard Clean price yourself</Checkbox>
      <Fold label="Deep Clean, also offered for a first visit">
        <Checkbox>Set the Deep Clean price yourself</Checkbox>
      </Fold>
    </FormPart>
  );
}

function Draft({ layout, c }: { layout: string; c: Case }) {
  const wide = useWide();
  const phone = !wide;
  const [start, setStart] = useState(c.start);
  const [days, setDays] = useState(c.days ?? []);
  const [active, setActive] = useState(0);
  const plan = !!c.plan;

  const placeDay = (i: number) => (at: LocalDateTime) =>
    setDays((ds) =>
      ds.map((d, n) =>
        n === i ? { ...d, start: at, title: `${weekdayName(at.date)}s` } : d,
      ),
    );

  // A's and C's: one calendar for the whole quote, a plan's weekdays on it
  // together, a segmented control saying which one a press places
  const scheduleFor = (span: 1 | 3 | 7) =>
    plan ? (
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label="Placing"
          value={String(active)}
          onChange={(v) => setActive(Number(v))}
        >
          {days.map((d, i) => (
            <Segment key={i} value={String(i)}>
              {d.title}
            </Segment>
          ))}
        </SegmentedControl>
        <OnTheSchedule
          span={span}
          phone={phone}
          picks={days.map((d) => ({ ...d, everyDays: 7 }))}
          active={active}
          onPick={placeDay(active)}
        />
        {days.map((d) => (
          <RoomLine key={d.title} at={d.start} title={d.title} />
        ))}
        <TypedTime
          at={days[active]?.start}
          onPick={placeDay(active)}
          label={`Type a date and time for ${days[active]?.title}`}
        />
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        <OnTheSchedule
          span={span}
          phone={phone}
          picks={[{ title: "This clean", start }]}
          active={0}
          onPick={setStart}
        />
        {start && <RoomLine at={start} />}
        <TypedTime at={start} onPick={setStart} />
      </div>
    );

  const proposedPart = (span: 1 | 3 | 7) => (
    <FormPart title={plan ? "First cleans" : "Proposed time"}>
      {scheduleFor(span)}
    </FormPart>
  );

  const weekdayParts = days.map((d, i) => (
    <FormPart
      key={i}
      title={d.title}
      actions={
        <Button variant="text" size="sm" onPress={say(`Remove ${d.title}`)}>
          <Trash2 aria-hidden size={16} />
          Remove {d.title}
        </Button>
      }
    >
      {layout !== "A" && (
        <>
          <OpenTimes
            start={d.start}
            onPick={placeDay(i)}
            title={d.title}
            withCrew={layout === "C"}
          />
          {!hasRoom(d.start, CREW, ON_SITE) && <RoomLine at={d.start} />}
          <TypedTime at={d.start} onPick={placeDay(i)} label="Another time" />
        </>
      )}
      <FieldRow>
        <NumberField label="Cleaners" minValue={1} maxValue={10} value={CREW} />
      </FieldRow>
      <Checkbox>Set the one-off price yourself</Checkbox>
    </FormPart>
  ));

  return (
    <AppLayout area="Office" nav={officeNav} foot={() => null}>
      <FormPage
        trail={[
          { label: "Quotes", href: linkTo({ to: "/office/quotes" }) },
          { label: "Okafor", href: linkTo({ to: "/office/quotes" }) },
          {
            label: "41-12 Austin St, 4B, 11375",
            href: linkTo({ to: "/office/quotes" }),
          },
          { label: "Quote", href: linkTo({ to: "/office/quotes" }) },
          { label: "Draft quote" },
        ]}
        title="Draft quote for Ada Okafor"
        actions={[
          {
            label: "Delete draft",
            icon: Trash2,
            danger: true,
            onAction: say("Delete draft"),
          },
        ]}
        aside={{ title: "Quote", leads: true, children: <Aside plan={plan} /> }}
        next={{ label: "Send", icon: Send, onAction: say("Send") }}
        price={
          plan
            ? {
                line: "Tuesdays $165.66 · Thursdays $165.66",
                short: "$165.66 a clean",
              }
            : {
                line: "Standard Clean $194.89",
                short: "Standard Clean $194.89",
              }
        }
        note="Saved"
      >
        <FormPart
          title="What was asked"
          summary={
            plan
              ? "A plan, every week · Standard Clean · Apartment · 2 bedrooms"
              : "Standard Clean · Apartment · 2 bedrooms · 1.5 bathrooms · moderate"
          }
        >
          <p>Made up.</p>
        </FormPart>
        {plan ? (
          <>
            <FormPart
              title="Plan"
              actions={
                <Button variant="text" size="sm" onPress={say("Add a weekday")}>
                  <CalendarPlus aria-hidden size={16} />
                  Add a weekday
                </Button>
              }
            >
              <Select
                label="How often"
                className="sm:w-80"
                defaultSelectedKey="weekly"
              >
                <SelectItem id="weekly">Every week</SelectItem>
                <SelectItem id="fortnightly">Every 2 weeks</SelectItem>
              </Select>
            </FormPart>
            {weekdayParts}
            {layout === "A" && proposedPart(1)}
          </>
        ) : (
          <ServicePart />
        )}
        <FormPart title="Extras" summary="None">
          <p>Made up.</p>
        </FormPart>
        <FormPart
          title="Terms"
          summary={
            plan
              ? "25% deposit · valid 14 days"
              : "2 cleaners · 25% deposit · valid 14 days"
          }
        >
          <p>Made up.</p>
        </FormPart>
        {layout === "A" && !plan && proposedPart(1)}
        {layout !== "A" && !plan && (
          <FormPart title="Proposed time">
            <OpenTimes
              start={start}
              onPick={setStart}
              withCrew={layout === "C"}
            />
            {start && !hasRoom(start, CREW, ON_SITE) && <RoomLine at={start} />}
            <TypedTime at={start} onPick={setStart} label="Another time" />
          </FormPart>
        )}
      </FormPage>
    </AppLayout>
  );
}

const officeNav: NavItem[] = navFor("en").office.map(
  ({ alsoCurrentFor: _a, jobSection: _j, countsOffers: _c, ...item }) => ({
    ...item,
    isCurrent: item.label === "Quotes",
  }),
);

export function ProposedTimePrototype() {
  const search = useSearch({ strict: false }) as {
    layout?: string;
    case?: string;
    shot?: string;
  };
  const navigate = useNavigate();
  const layout = LAYOUTS.some((l) => l.key === search.layout)
    ? search.layout!
    : "A";
  const caseKey = search.case && CASES[search.case] ? search.case : "1";
  const go = (change: { layout?: string; case?: string }) =>
    void navigate({
      to: "/prototype/proposed-time",
      search: { layout, case: caseKey, ...change },
    } as never);
  return (
    <>
      <Draft key={`${layout}-${caseKey}`} layout={layout} c={CASES[caseKey]!} />
      {!search.shot && (
        <>
          <PrototypeSwitcher
            variants={LAYOUTS}
            current={layout}
            keys={["ArrowUp", "ArrowDown"]}
            className="bottom-36 md:bottom-16"
            onChange={(key) => go({ layout: key })}
          />
          <PrototypeSwitcher
            variants={Object.entries(CASES).map(([key, c]) => ({
              key,
              name: c.name,
            }))}
            current={caseKey}
            onChange={(key) => go({ case: key })}
          />
        </>
      )}
    </>
  );
}
