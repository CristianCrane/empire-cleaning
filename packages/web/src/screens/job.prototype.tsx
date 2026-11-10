// PROTOTYPE: throwaway. The Office's Job page (#406): labelled actions on
// their own row under the title, "Job details" with an icon per fact, and
// the Crew list drawn as the Staff list, an X where its chevron goes. On
// made-up data at /prototype/job?case=&layout= (no sign-in). ↑/↓ switch
// layouts, ←/→ cases. Nothing is sent. Lives only on
// prototype-job-page-actions.
//
// A: today: an ActionBar of icons beside the title, named in tooltips (#146).
// B: outlined (secondary) labelled Buttons on a row under the title; they
//    wrap on a phone.
// C: text Buttons with icon and label on a row under the title (the
//    Section-action look); they wrap on a phone.
// D: Move job labelled, the rest in a "More" menu.
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarSync,
  CalendarX,
  CalendarCog,
  Clock,
  ContactRound,
  Ellipsis,
  EllipsisVertical,
  ChevronDown,
  House,
  ListPlus,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ActionBar,
  AppLayout,
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  IconAction,
  Link,
  List,
  ListItem,
  Menu,
  MenuItem,
  MenuPopover as Popover,
  MenuSeparator,
  Tooltip,
  TooltipTrigger,
  MenuTrigger,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { navFor } from "./AreaLayout.tsx";
import { linkTo } from "../links.ts";

const jobs = linkTo({ to: "/office/jobs" });

type Member = {
  name: string;
  status: "offered" | "confirmed";
  since: string;
  imageUrl?: string;
};

type Case = {
  key: string;
  name: string;
  crewSize: number;
  crew: Member[];
};

const cases: Case[] = [
  { key: "1", name: "crew of 0", crewSize: 2, crew: [] },
  {
    key: "2",
    name: "crew of 1",
    crewSize: 1,
    crew: [{ name: "Maria Gonzalez", status: "confirmed", since: "Nov 3" }],
  },
  {
    key: "3",
    name: "crew of 3",
    crewSize: 3,
    crew: [
      { name: "Maria Gonzalez", status: "confirmed", since: "Nov 3" },
      {
        name: "Ana Lucía Hernández-Restrepo",
        status: "confirmed",
        since: "Nov 4",
      },
      { name: "Jordan Lee", status: "confirmed", since: "Nov 6" },
    ],
  },
  {
    key: "4",
    name: "one Offered, with a badge",
    crewSize: 3,
    crew: [
      { name: "Maria Gonzalez", status: "confirmed", since: "Nov 3" },
      {
        name: "Ana Lucía Hernández-Restrepo",
        status: "offered",
        since: "Nov 8",
      },
      { name: "Jordan Lee", status: "confirmed", since: "Nov 6" },
    ],
  },
];

const layouts = [
  { key: "A", name: "today: icons beside the title" },
  { key: "B", name: "outlined buttons, own row" },
  { key: "C", name: "text buttons, own row" },
  { key: "D", name: "Move + More menu" },
  { key: "E", name: "⋮ menu beside the title" },
  { key: "F", name: "Actions ▾ menu beside the title" },
];

export function JobPrototype() {
  const search = useSearch({ strict: false }) as {
    case?: string;
    layout?: string;
  };
  const navigate = useNavigate();
  const key = search.case ?? "3";
  const layout = search.layout ?? "A";
  const go = (next: { case?: string; layout?: string }) =>
    void navigate({
      to: "/prototype/job",
      search: { case: key, layout, ...next } as never,
      replace: true,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;
  const nav = navFor("en").office.map(({ alsoCurrentFor: _, ...item }) => ({
    ...item,
    isCurrent: item.label === "Jobs",
  }));

  return (
    <>
      <AppLayout area="Office" nav={nav} foot={() => null}>
        <div className="flex flex-col gap-6">
          <Header layout={layout} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-6">
              <Section title="Job details">
                <Card>
                  <Details crewSize={c.crewSize} />
                </Card>
              </Section>
              <Crew c={c} />
            </div>
            <div className="flex flex-col gap-6">
              <Section title="History">
                <p className="text-sm text-fg-muted">
                  (History stays as it is.)
                </p>
              </Section>
            </div>
          </div>
        </div>
      </AppLayout>
      <PrototypeSwitcher
        variants={layouts}
        current={layout}
        onChange={(k) => go({ layout: k })}
        keys={["ArrowUp", "ArrowDown"]}
        className="bottom-36 md:bottom-16"
      />
      <PrototypeSwitcher
        variants={cases}
        current={c.key}
        onChange={(k) => go({ case: k })}
      />
    </>
  );
}

function Header({ layout }: { layout: string }) {
  const title = (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>Standard Clean at 1420 Maple Ave, Unit 3B</Heading>
        <StatusBadge tone="info">Staffed</StatusBadge>
      </div>
      <p className="text-lg text-fg-muted">Thu, Nov 19, 9:00 AM</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs trail={[{ label: "Jobs", href: jobs }, { label: "Job" }]} />
      {layout === "E" || layout === "F" ? (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{title}</div>
          <JobMenu labelled={layout === "F"} />
        </div>
      ) : layout === "A" ? (
        <div className="flex flex-wrap items-start gap-3">
          {title}
          <div className="ml-auto">
            <ActionBar aria-label="Job actions">
              <IconAction icon={CalendarSync} label="Move job" />
              <IconAction icon={CalendarClock} label="Ask for a new time" />
              <IconAction icon={CalendarX} label="Cancel job" danger />
            </ActionBar>
          </div>
        </div>
      ) : (
        <>
          {title}
          <Actions layout={layout} />
        </>
      )}
    </div>
  );
}

// every Job action in one menu, behind a ⋮ at the end of the title row,
// or (labelled) an outlined "Actions ▾" Button there
function JobMenu({ labelled = false }: { labelled?: boolean }) {
  return (
    <MenuTrigger>
      {labelled ? (
        <Button variant="secondary" className="shrink-0">
          Actions
          <ChevronDown aria-hidden size={18} />
        </Button>
      ) : (
        <TooltipTrigger delay={300} closeDelay={0}>
          <Button
            variant="quiet"
            size="icon"
            aria-label="Job actions"
            className="-mr-2 shrink-0"
          >
            <EllipsisVertical aria-hidden size={22} />
          </Button>
          <Tooltip
            offset={6}
            className="rounded-md bg-fg px-2 py-1 text-sm font-semibold text-bg shadow-overlay"
          >
            Job actions
          </Tooltip>
        </TooltipTrigger>
      )}
      <Popover
        placement="bottom end"
        offset={4}
        className="min-w-56 overflow-auto rounded-lg border border-border bg-overlay p-1 text-fg shadow-overlay outline-none"
      >
        <Menu className="outline-none">
          <Item icon={CalendarSync}>Move job</Item>
          <Item icon={CalendarClock}>Ask for a new time</Item>
          <MenuSeparator className="my-1 border-t border-border" />
          <Item icon={CalendarX} danger>
            Cancel job
          </Item>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function Actions({ layout }: { layout: string }) {
  if (layout === "D") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary">
          <CalendarSync aria-hidden size={18} />
          Move job
        </Button>
        <MenuTrigger>
          <Button variant="quiet" aria-label="More">
            <Ellipsis aria-hidden size={18} />
            More
          </Button>
          <Popover
            placement="bottom start"
            offset={4}
            className="min-w-56 overflow-auto rounded-lg border border-border bg-overlay p-1 text-fg shadow-overlay outline-none"
          >
            <Menu className="outline-none">
              <Item icon={CalendarClock}>Ask for a new time</Item>
              <Item icon={CalendarX} danger>
                Cancel job
              </Item>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    );
  }
  const outlined = layout === "B";
  return (
    <div
      role="toolbar"
      aria-label="Job actions"
      className={`flex flex-wrap items-center ${outlined ? "gap-2" : "gap-1 -ml-3"}`}
    >
      <Button variant={outlined ? "secondary" : "text"}>
        <CalendarSync aria-hidden size={18} />
        Move job
      </Button>
      <Button variant={outlined ? "secondary" : "text"}>
        <CalendarClock aria-hidden size={18} />
        Ask for a new time
      </Button>
      <Button
        variant="danger-text"
        className={outlined ? "border border-danger" : ""}
      >
        <CalendarX aria-hidden size={18} />
        Cancel job
      </Button>
    </div>
  );
}

function Item({
  icon: Icon,
  danger = false,
  children,
}: {
  icon: LucideIcon;
  danger?: boolean;
  children: string;
}) {
  return (
    <MenuItem
      textValue={children}
      className={`flex min-h-touch cursor-default items-center gap-3 rounded-md px-3 font-semibold outline-none focus:bg-surface-sunken ${danger ? "text-danger" : "text-fg"}`}
    >
      <Icon aria-hidden size={18} />
      {children}
    </MenuItem>
  );
}

// each fact: an icon beside its label, the value after
function Details({ crewSize }: { crewSize: number }) {
  const row = (icon: LucideIcon, label: string, value: ReactNode) => {
    const Icon = icon;
    return (
      <>
        <dt className="flex items-center gap-2 font-semibold">
          <Icon aria-hidden size={18} className="shrink-0 text-fg-muted" />
          {label}
        </dt>
        <dd className="max-sm:mb-2 max-sm:pl-7">{value}</dd>
      </>
    );
  };
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      {row(ContactRound, "Client", <Link href={jobs}>Dana Whitfield</Link>)}
      {row(
        House,
        "Home",
        <Link href={jobs}>1420 Maple Ave, Unit 3B, Springfield</Link>,
      )}
      {row(ListPlus, "Extras", "Inside the fridge, Inside the oven")}
      {row(Clock, "Cleaning hours", "6 hours")}
      {row(
        Users,
        "Cleaners",
        `${crewSize}, ${crewSize > 0 ? `${6 / crewSize} hours` : "—"} on site`,
      )}
      {row(CalendarSync, "Moving", "Free until Tue, Nov 17, 9:00 AM")}
      {row(
        CalendarCog,
        "Cancelling",
        "Free for the client until Tue, Nov 17, 9:00 AM",
      )}
    </dl>
  );
}

// the Staff list's rows: Avatar, name, a muted line, a badge only when it's
// not the usual (Offered, as Staff's Invited); an X where the chevron goes
function Crew({ c }: { c: Case }) {
  const confirmed = c.crew.filter((m) => m.status === "confirmed").length;
  const needed = c.crewSize - c.crew.length;
  return (
    <Section
      title="Crew"
      description={`${confirmed} of ${c.crewSize} confirmed`}
      actions={
        needed > 0 && (
          <Button variant="text" size="sm">
            <UserPlus aria-hidden size={16} />
            Offer to a cleaner
          </Button>
        )
      }
    >
      {c.crew.length === 0 ? (
        <p className="text-sm text-fg-muted">Nobody is on it yet.</p>
      ) : (
        <List aria-label="Crew">
          {c.crew.map((m) => (
            <ListItem
              key={m.name}
              id={m.name}
              title={m.name}
              start={<Avatar src={m.imageUrl} />}
              description={`${m.status === "confirmed" ? "Confirmed" : "Offered"} ${m.since}`}
              end={
                m.status === "offered" ? (
                  <StatusBadge tone="warning">Offered</StatusBadge>
                ) : undefined
              }
              action={
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={`Take ${m.name} off`}
                  className="-mr-2"
                >
                  <X aria-hidden size={20} className="text-fg-muted" />
                </Button>
              }
            />
          ))}
        </List>
      )}
    </Section>
  );
}
