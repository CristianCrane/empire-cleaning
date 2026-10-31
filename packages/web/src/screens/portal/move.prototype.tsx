// PROTOTYPE: throwaway. A Client moving a clean, on made-up data, at
// /prototype/move?case=1..3&layout=A..C (no sign-in). Today it's a dialog of
// two dropdowns whose "Pick on the calendar" opens a second dialog. A is one
// wide dialog with the week's open times in it; B is a page of its own, the
// week filling it; C is one dialog with a month to pick a day from, then
// that day's times. Each keeps the dropdowns as the keyboard path. For the
// UX pass (#96). Lives only on prototype-move.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { parseDate, type CalendarDate } from "@internationalized/date";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  House,
  MapPin,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  Actions,
  AppLayout,
  Breadcrumbs,
  Button,
  Calendar,
  Card,
  Dialog,
  Heading,
  type NavItem,
  Notice,
  Section,
  Select,
  SelectItem,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "../Fact.tsx";

const here = linkTo({ to: "/prototype/move" });

// ---- made-up data ----

type Day = { date: string; label: string; short: string; times: string[] };

// two weeks from Mon, Nov 9; weekends and full days have nothing
const days: Day[] = [
  {
    date: "2026-11-09",
    label: "Mon, Nov 9",
    short: "Mon 9",
    times: ["09:00", "13:00"],
  },
  { date: "2026-11-10", label: "Tue, Nov 10", short: "Tue 10", times: [] },
  {
    date: "2026-11-11",
    label: "Wed, Nov 11",
    short: "Wed 11",
    times: ["09:00", "10:00", "13:00", "14:00"],
  },
  {
    date: "2026-11-12",
    label: "Thu, Nov 12",
    short: "Thu 12",
    times: ["09:00"],
  },
  {
    date: "2026-11-13",
    label: "Fri, Nov 13",
    short: "Fri 13",
    times: ["10:00", "13:00"],
  },
  { date: "2026-11-14", label: "Sat, Nov 14", short: "Sat 14", times: [] },
  { date: "2026-11-15", label: "Sun, Nov 15", short: "Sun 15", times: [] },
  {
    date: "2026-11-16",
    label: "Mon, Nov 16",
    short: "Mon 16",
    times: ["09:00", "10:00", "13:00"],
  },
  {
    date: "2026-11-17",
    label: "Tue, Nov 17",
    short: "Tue 17",
    times: ["09:00", "14:00"],
  },
  { date: "2026-11-18", label: "Wed, Nov 18", short: "Wed 18", times: [] },
  {
    date: "2026-11-19",
    label: "Thu, Nov 19",
    short: "Thu 19",
    times: ["09:00", "10:00"],
  },
  {
    date: "2026-11-20",
    label: "Fri, Nov 20",
    short: "Fri 20",
    times: ["13:00"],
  },
  { date: "2026-11-21", label: "Sat, Nov 21", short: "Sat 21", times: [] },
  { date: "2026-11-22", label: "Sun, Nov 22", short: "Sun 22", times: [] },
];
const allTimes = ["09:00", "10:00", "13:00", "14:00"];
const now = { date: "2026-11-10", time: "09:00" };

type MoveCase = {
  key: string;
  name: string;
  cost: string;
  tone: "info" | "warning";
};
const cases: MoveCase[] = [
  {
    key: "1",
    name: "Free to move",
    cost: "There's no charge for moving it.",
    tone: "info",
  },
  {
    key: "2",
    name: "A Late Reschedule, free",
    cost: "It's less than 24 hours until your clean, so this is a Late Reschedule. Your first one is free, and your Deposit still counts towards the price.",
    tone: "warning",
  },
  {
    key: "3",
    name: "A Late Cancellation",
    cost: "You've used your free Late Reschedule, so moving it is a Late Cancellation: your $74.85 Deposit is kept as the fee.",
    tone: "warning",
  },
];

const layouts = [
  { key: "A", name: "One wide dialog, the week in it" },
  { key: "B", name: "A page of its own" },
  { key: "C", name: "A month, then the day's times" },
];

const nav: NavItem[] = [
  { href: here, label: "Home", icon: House },
  { href: here, label: "Cleans", icon: Sparkles, isCurrent: true },
  { href: here, label: "Payments", icon: Wallet },
  { href: here, label: "Your details", icon: UserRound },
];

const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const labelOf = (date: string) =>
  days.find((d) => d.date === date)?.label ?? date;

// ---- the page ----

export function MovePrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/move",
      search: { case: key, layout, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;

  return (
    <AppLayout
      area="Client"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Casey</span>}
    >
      {layout === "B" ? (
        <MovePage key={c.key} c={c} />
      ) : (
        <JobPage key={c.key + layout} c={c} layout={layout} />
      )}
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

// the Job's page as it is, with its "Need another time?" card
function JobPage({ c, layout }: { c: MoveCase; layout: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        trail={[{ label: "Cleans", href: here }, { label: "Deep Clean" }]}
      />
      <Heading level={1}>Deep Clean</Heading>
      <Section title="Need another time?">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>{c.cost}</p>
            <Button variant="secondary" onPress={() => setOpen(true)}>
              Choose a new time
            </Button>
          </div>
        </Card>
      </Section>
      {open && (
        <Dialog
          title="Choose a new time"
          size={layout === "A" ? "wide" : "md"}
          isOpen
          onOpenChange={(o) => !o && setOpen(false)}
        >
          {layout === "A" ? (
            <WeekChoice c={c} close={() => setOpen(false)} />
          ) : (
            <MonthChoice c={c} close={() => setOpen(false)} />
          )}
        </Dialog>
      )}
    </div>
  );
}

// ---- the parts ----

type Pick = { date: string | null; time: string | null };

// the week's open times as a grid of buttons: a column a day, a row a start
// time; the clean's own time marked
function Week({ pick, setPick }: { pick: Pick; setPick: (p: Pick) => void }) {
  const [week, setWeek] = useState(0);
  const shown = days.slice(week * 7, week * 7 + 7);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          variant="text"
          size="sm"
          isDisabled={week === 0}
          onPress={() => setWeek(0)}
          aria-label="Previous week"
        >
          <ChevronLeft aria-hidden size={18} />
        </Button>
        <span className="font-semibold">
          {shown[0]!.label.slice(5)} to {shown[6]!.label.slice(5)}
        </span>
        <Button
          variant="text"
          size="sm"
          isDisabled={week === 1}
          onPress={() => setWeek(1)}
          aria-label="Next week"
        >
          <ChevronRight aria-hidden size={18} />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[36rem] grid-cols-[4rem_repeat(7,minmax(0,1fr))] gap-1 text-sm">
          <span />
          {shown.map((d) => (
            <span key={d.date} className="text-center font-semibold text-fg">
              {d.short}
            </span>
          ))}
          {allTimes.map((t) => (
            <div key={t} className="contents">
              <span className="py-2 text-fg-muted">{clock(t)}</span>
              {shown.map((d) => {
                const isNow = d.date === now.date && t === now.time;
                const open = d.times.includes(t);
                const chosen = pick.date === d.date && pick.time === t;
                return isNow ? (
                  <span
                    key={d.date}
                    className="rounded-md border-2 border-dashed border-border-strong py-2 text-center text-xs text-fg-muted"
                  >
                    Now
                  </span>
                ) : open ? (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setPick({ date: d.date, time: t })}
                    className={`rounded-md py-2 text-center font-semibold ${chosen ? "bg-primary text-primary-fg" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                    aria-label={`${d.label}, ${clock(t)}`}
                    aria-pressed={chosen}
                  >
                    {clock(t).replace(":00", "")}
                  </button>
                ) : (
                  <span
                    key={d.date}
                    className="rounded-md bg-surface-sunken py-2"
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// the keyboard path: the same choice, as two dropdowns
function Fields({ pick, setPick }: { pick: Pick; setPick: (p: Pick) => void }) {
  const day = days.find((d) => d.date === pick.date);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-primary">
        Or choose from a list
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Select
          label="Day"
          selectedKey={pick.date}
          onSelectionChange={(k) => setPick({ date: String(k), time: null })}
        >
          {days
            .filter((d) => d.times.length)
            .map((d) => (
              <SelectItem key={d.date} id={d.date}>
                {d.label}
              </SelectItem>
            ))}
        </Select>
        <Select
          label="Start time"
          isDisabled={!day}
          selectedKey={pick.time}
          onSelectionChange={(k) => setPick({ ...pick, time: String(k) })}
        >
          {(day?.times ?? []).map((t) => (
            <SelectItem key={t} id={t}>
              {clock(t)}
            </SelectItem>
          ))}
        </Select>
      </div>
    </details>
  );
}

// what they've chosen and what it costs, then send
function Foot({
  c,
  pick,
  close,
}: {
  c: MoveCase;
  pick: Pick;
  close?: () => void;
}) {
  const ready = pick.date && pick.time;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-fg">
        {ready ? (
          <>
            Move it to{" "}
            <strong>
              {labelOf(pick.date!)} at {clock(pick.time!)}
            </strong>
          </>
        ) : (
          <span className="text-fg-muted">Choose an open time.</span>
        )}
      </p>
      <Notice tone={c.tone}>{c.cost}</Notice>
      <p className="text-sm text-fg-muted">
        The new time is held while the Office confirms it. Until then, your
        clean stays booked for Tue, Nov 10 at 9:00 AM.
      </p>
      <Actions>
        {close && (
          <Button variant="quiet" onPress={close}>
            Keep the current time
          </Button>
        )}
        <Button isDisabled={!ready}>Send request</Button>
      </Actions>
    </div>
  );
}

// A: the week in one wide dialog
function WeekChoice({ c, close }: { c: MoveCase; close: () => void }) {
  const [pick, setPick] = useState<Pick>({ date: null, time: null });
  return (
    <>
      <p className="text-sm text-fg-muted">
        Open times for your Deep Clean, about 2 h 30 min on site. New York time.
      </p>
      <Week pick={pick} setPick={setPick} />
      <Fields pick={pick} setPick={setPick} />
      <Foot c={c} pick={pick} close={close} />
    </>
  );
}

// C: a month to pick a day from, then that day's times
function MonthChoice({ c, close }: { c: MoveCase; close: () => void }) {
  const [pick, setPick] = useState<Pick>({ date: null, time: null });
  const day = days.find((d) => d.date === pick.date);
  return (
    <>
      <div className="flex justify-center">
        <Calendar<CalendarDate>
          aria-label="Day"
          value={pick.date ? parseDate(pick.date) : null}
          minValue={parseDate("2026-11-09")}
          maxValue={parseDate("2026-11-22")}
          isDateUnavailable={(d) =>
            !days.find((x) => x.date === d.toString())?.times.length
          }
          onChange={(d) => setPick({ date: d.toString(), time: null })}
        />
      </div>
      {day ? (
        <div className="flex flex-col gap-2">
          <span className="font-semibold">{day.label}: open times</span>
          <div className="grid grid-cols-3 gap-2">
            {day.times.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPick({ ...pick, time: t })}
                aria-pressed={pick.time === t}
                className={`rounded-md py-2 font-semibold ${pick.time === t ? "bg-primary text-primary-fg" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
              >
                {clock(t)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          Days with room are the ones you can pick. Your clean is now on Tue,
          Nov 10 at 9:00 AM.
        </p>
      )}
      <Foot c={c} pick={pick} close={close} />
    </>
  );
}

// B: a page of its own
function MovePage({ c }: { c: MoveCase }) {
  const [pick, setPick] = useState<Pick>({ date: null, time: null });
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        trail={[
          { label: "Cleans", href: here },
          { label: "Deep Clean", href: here },
          { label: "Move it" },
        ]}
      />
      <Heading level={1}>Move your clean</Heading>
      <Card>
        <div className="@container">
          <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2">
            <Fact
              icon={CalendarClock}
              label="Now"
              value="Tue, Nov 10 at 9:00 AM"
              line="When it's booked now"
            />
            <Fact
              icon={MapPin}
              label="Where"
              value="35-06 Ditmars Blvd, Apt 4B"
              line="Deep Clean, about 2 h 30 min"
            />
          </dl>
        </div>
      </Card>
      <Section
        title="Choose an open time"
        description="New York time. Only times with a crew free are shown."
      >
        <Card>
          <Week pick={pick} setPick={setPick} />
          <Fields pick={pick} setPick={setPick} />
        </Card>
      </Section>
      <Card>
        <Foot c={c} pick={pick} />
      </Card>
    </div>
  );
}
