// PROTOTYPE: throwaway. The Office's page for one Staff member, on made-up
// data, at /prototype/staff?case=1..4&layout=A..C (no sign-in). A reads
// their week as a strip and the days that differ as a list, each changed in
// a dialog; B shows the month as a calendar, a day opening its dialog; C is
// two columns, the days that differ on the right. For the UX pass (#96).
// Lives only on prototype-staff.
import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  ContactRound,
  LayoutDashboard,
  Mail,
  SquarePen,
  Tag,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import {
  Actions,
  AppLayout,
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  IconTile,
  List,
  ListItem,
  type NavItem,
  Notice,
  NumberField,
  Section,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "../Fact.tsx";
import { JobIcon, QuoteIcon } from "../icons.ts";

const here = linkTo({ to: "/prototype/staff" });

// ---- made-up data ----

type Day = {
  date: string;
  day: number;
  label: string;
  hours: number;
  note?: string;
};

type StaffCase = {
  key: string;
  name: string;
  member: string;
  email: string;
  roles: string;
  cleaner: boolean;
  status?: { tone: "info" | "neutral"; label: string };
  signedUp: string;
  active: boolean;
  week: number[];
  exceptions: Day[];
};

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ana: StaffCase = {
  key: "1",
  name: "Cleaner, days off",
  member: "Ana Ruiz",
  email: "ana.ruiz@example.com",
  roles: "Cleaner",
  cleaner: true,
  signedUp: "Signed up Sep 2",
  active: true,
  week: [8, 8, 8, 8, 6, 0, 0],
  exceptions: [
    {
      date: "2026-11-11",
      day: 11,
      label: "Wed, Nov 11",
      hours: 0,
      note: "Veterans Day",
    },
    {
      date: "2026-11-14",
      day: 14,
      label: "Sat, Nov 14",
      hours: 5,
      note: "Covering the Bedford Ave deep clean",
    },
    {
      date: "2026-11-26",
      day: 26,
      label: "Thu, Nov 26",
      hours: 0,
      note: "Thanksgiving",
    },
    { date: "2026-11-27", day: 27, label: "Fri, Nov 27", hours: 0 },
  ],
};

const invited: StaffCase = {
  ...ana,
  key: "2",
  name: "Cleaner, invited",
  member: "Ben Okafor",
  email: "ben.okafor@example.com",
  status: { tone: "info", label: "Invited" },
  signedUp: "Invited Oct 29: not signed up yet",
  week: [0, 6, 6, 6, 6, 0, 0],
  exceptions: [],
};

const office: StaffCase = {
  ...ana,
  key: "3",
  name: "Office Staff",
  member: "Olive Owner",
  email: "olive@example.com",
  roles: "Office Staff",
  cleaner: false,
  signedUp: "Signed up Jun 1",
};

const gone: StaffCase = {
  ...ana,
  key: "4",
  name: "deactivated",
  member: "Cory Cleaner",
  email: "cory@example.com",
  status: { tone: "neutral", label: "Deactivated" },
  active: false,
};

const cases = [ana, invited, office, gone];

const layouts = [
  { key: "A", name: "Week strip, days that differ as a list" },
  { key: "B", name: "The month as a calendar" },
  { key: "C", name: "Two columns, days that differ right" },
];

const nav: NavItem[] = [
  { href: here, label: "Today", icon: LayoutDashboard },
  { href: here, label: "Quotes", icon: QuoteIcon },
  { href: here, label: "Jobs", icon: JobIcon },
  { href: here, label: "Clients", icon: ContactRound },
  { href: here, label: "Schedule", icon: CalendarDays },
  { href: here, label: "Staff", icon: Users, isCurrent: true },
  { href: here, label: "Price List", icon: Tag },
];

const hrs = (h: number) => (h === 0 ? "Off" : `${h} h`);

// ---- the page ----

export function StaffPrototype() {
  const { case: key = "1", layout = "A" } = useSearch({
    strict: false,
  }) as { case?: string; layout?: string };
  const navigate = useNavigate();
  const go = (search: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/staff",
      search: { case: key, layout, ...search } as never,
    });
  const m = cases.find((x) => x.key === key) ?? ana;
  const availability = m.active && m.cleaner;

  return (
    <AppLayout
      area="Office"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Office</span>}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Breadcrumbs
            trail={[{ label: "Staff", href: here }, { label: m.member }]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Avatar src={null} size="lg" />
              <div className="flex flex-wrap items-center gap-3">
                <Heading level={1}>{m.member}</Heading>
                {m.status && (
                  <StatusBadge tone={m.status.tone}>
                    {m.status.label}
                  </StatusBadge>
                )}
              </div>
            </div>
            {m.active && (
              <Button variant="danger-text" size="sm">
                <Ban aria-hidden size={16} />
                Deactivate
              </Button>
            )}
          </div>
        </div>
        {!m.active && (
          <Notice>
            {m.member} has no Staff access. Invite them again to bring them
            back.
          </Notice>
        )}
        {m.active && !m.cleaner && (
          <Notice>
            Only Cleaners' hours count towards the Schedule, so there's no
            availability to set for {m.member}.
          </Notice>
        )}
        {layout === "C" && availability ? (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-6">
              <Details m={m} />
              <UsualWeek m={m} />
            </div>
            <DaysThatDiffer m={m} />
          </div>
        ) : (
          <>
            <Details m={m} />
            {availability && layout === "A" && (
              <>
                <UsualWeek m={m} />
                <DaysThatDiffer m={m} />
              </>
            )}
            {availability && layout === "B" && <Month m={m} />}
          </>
        )}
      </div>
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-40 md:bottom-20"
      />
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={m.key}
        onChange={(k) => go({ case: k })}
      />
    </AppLayout>
  );
}

// ---- the parts ----

function Details({ m }: { m: StaffCase }) {
  return (
    <Section title="Details">
      <Card>
        <div className="@container">
          <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
            <Fact icon={Mail} label="Email" value={m.email} />
            <Fact icon={UserRound} label="Roles" value={m.roles} line="Roles" />
            <Fact
              icon={UserCheck}
              label="Signed up"
              value={m.signedUp}
              line="Their account"
            />
          </dl>
        </div>
      </Card>
    </Section>
  );
}

// a tile a day, Monday first: its hours, or Off
function UsualWeek({ m }: { m: StaffCase }) {
  return (
    <Section
      title="Usual week"
      description="The hours they can usually work each day."
      actions={<EditWeek m={m} />}
    >
      <Card>
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map((d, i) => (
            <div
              key={d}
              className={`flex flex-col items-center gap-1 rounded-md py-3 ${m.week[i] ? "bg-primary/10 text-fg" : "bg-surface-sunken text-fg-muted"}`}
            >
              <span className="text-sm">{d}</span>
              <span className="font-semibold">{hrs(m.week[i]!)}</span>
            </div>
          ))}
        </div>
      </Card>
    </Section>
  );
}

function EditWeek({ m }: { m: StaffCase }) {
  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <SquarePen aria-hidden size={16} />
        Edit
      </Button>
      <Dialog title="Usual week" size="lg">
        {({ close }) => (
          <>
            <p className="text-sm text-fg-muted">
              The hours they can usually work each day. Days off are 0.
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
              {weekdays.map((d, i) => (
                <NumberField key={d} label={d} defaultValue={m.week[i]} />
              ))}
            </div>
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button onPress={close}>Save usual week</Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// the days that differ from the usual week, soonest first: each opens its
// dialog; a new one from the header
function DaysThatDiffer({ m }: { m: StaffCase }) {
  const [open, setOpen] = useState<Day | null>(null);
  return (
    <Section
      title="Days off and extra days"
      description="A day here replaces their usual hours for that day."
      actions={
        <Button variant="text" size="sm" onPress={() => setOpen(blank)}>
          <CalendarPlus aria-hidden size={16} />
          Add a day
        </Button>
      }
    >
      <List
        aria-label="Days that differ from the usual week"
        onAction={(id) =>
          setOpen(m.exceptions.find((e) => e.date === id) ?? null)
        }
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">
            None: every day is as usual.
          </p>
        )}
      >
        {m.exceptions.map((e) => (
          <ListItem
            key={e.date}
            id={e.date}
            start={
              <IconTile
                icon={e.hours ? CalendarPlus : CalendarX}
                tone={e.hours ? "info" : "warning"}
              />
            }
            title={`${e.label}: ${hrs(e.hours)}`}
            description={e.note}
          />
        ))}
      </List>
      {open && <DayDialog day={open} close={() => setOpen(null)} />}
    </Section>
  );
}

const blank: Day = { date: "", day: 0, label: "", hours: 0 };

// one day's hours: saved, or back to the usual week
function DayDialog({ day, close }: { day: Day; close: () => void }) {
  const isNew = !day.date;
  return (
    <Dialog
      title={isNew ? "Add a day" : day.label}
      isOpen
      onOpenChange={(o) => !o && close()}
    >
      {isNew && <TextField label="Day" placeholder="Pick a day" />}
      <NumberField label="Hours that day" defaultValue={day.hours} />
      <TextField label="Note (optional)" defaultValue={day.note} />
      <Actions>
        {isNew ? (
          <Button variant="quiet" onPress={close}>
            Cancel
          </Button>
        ) : (
          <Button variant="quiet" onPress={close}>
            Back to the usual week
          </Button>
        )}
        <Button onPress={close}>Save day</Button>
      </Actions>
    </Dialog>
  );
}

// November as a calendar: each day its hours, the days that differ marked;
// a day opens its dialog
function Month({ m }: { m: StaffCase }) {
  const [open, setOpen] = useState<Day | null>(null);
  // Nov 1 2026 is a Sunday: six blanks before it, Monday first
  const cells = [
    ...Array.from({ length: 6 }, () => null),
    ...Array.from({ length: 30 }, (_, i) => i + 1),
  ];
  return (
    <Section
      title="Availability"
      description="Their usual week, and the days that differ. Pick a day to change it."
      actions={<EditWeek m={m} />}
    >
      <Card>
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-fg">November 2026</p>
          <div className="grid grid-cols-7 gap-1 text-center text-sm text-fg-muted">
            {weekdays.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((n, i) => {
              if (n === null) return <span key={`b${i}`} />;
              const usual = m.week[i % 7]!;
              const ex = m.exceptions.find((e) => e.day === n);
              const hours = ex ? ex.hours : usual;
              const tone = ex
                ? ex.hours
                  ? "bg-info-subtle text-fg ring-1 ring-info-strong"
                  : "bg-warning-subtle text-fg ring-1 ring-warning-strong"
                : hours
                  ? "bg-surface text-fg"
                  : "bg-surface-sunken text-fg-muted";
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setOpen(
                      ex ?? {
                        date: `2026-11-${n}`,
                        day: n,
                        label: `${weekdays[i % 7]}, Nov ${n}`,
                        hours: usual,
                      },
                    )
                  }
                  className={`flex min-h-16 flex-col items-start rounded-md border border-border p-2 text-start hover:border-primary ${tone}`}
                >
                  <span className="text-sm">{n}</span>
                  <span className="font-semibold">{hrs(hours)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-fg-muted">
            Outlined days differ from the usual week: amber for time off, blue
            for extra hours.
          </p>
        </div>
      </Card>
      {open && <DayDialog day={open} close={() => setOpen(null)} />}
    </Section>
  );
}
