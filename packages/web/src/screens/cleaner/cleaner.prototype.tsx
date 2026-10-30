// PROTOTYPE: throwaway. The Cleaner's Your Jobs (only theirs), Offers (places
// offered or open to them) and a Job's page, on made-up data, at
// /prototype/cleaner?case=1..5&page=jobs|offers (&job=<id>&actions=A..B for
// a Job; no sign-in). A Job's actions: A cards, B a bar at the foot. For the
// UX pass (#96). Lives only on prototype-cleaner.
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarDays,
  CirclePlus,
  Clock,
  DoorClosed,
  Eye,
  Inbox,
  KeyRound,
  MapPin,
  Navigation,
  Phone,
  Users,
} from "lucide-react";
import {
  ActionRow,
  AppLayout,
  Breadcrumbs,
  Button,
  buttonStyles,
  Card,
  DateTile,
  EmptyState,
  Heading,
  IconTile,
  List,
  ListItem,
  type NavItem,
  Notice,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { Fact } from "../portal/Fact.tsx";

// ---- made-up data: Monday 2 November 2026 ----

type Job = {
  id: string;
  // "2026-11-02T14:00:00Z"
  at: string;
  // "Today", "Tomorrow", "Thu, Nov 5"
  day: string;
  time: string;
  until: string;
  service: string;
  hours: string;
  address: string;
  area: string;
  access: string | null;
  addOns: string[];
  client: string;
  phone: string | null;
  crew: { name: string; confirmed: boolean }[];
  offered?: boolean;
  started?: boolean;
  done?: boolean;
  visit?: boolean;
};

type Open = {
  id: string;
  at: string;
  day: string;
  time: string;
  service: string;
  hours: string;
  area: string;
  crew: string;
};

type CleanerCase = { key: string; name: string; jobs: Job[]; open: Open[] };

const morning: Job = {
  id: "austin",
  at: "2026-11-02T14:00:00Z",
  day: "Today",
  time: "9:00 AM",
  until: "12:00 PM",
  service: "Standard Clean",
  hours: "3 h",
  address: "41-12 Austin St, 4B, 11375",
  area: "Forest Hills",
  access: "Buzz 4B. Spare key with the doorman, Luis. Street parking only.",
  addOns: ["Inside the oven"],
  client: "Casey",
  phone: "(718) 555-0142",
  crew: [{ name: "You", confirmed: true }],
};

const afternoon: Job = {
  ...morning,
  id: "grand",
  at: "2026-11-02T19:00:00Z",
  time: "2:00 PM",
  until: "6:00 PM",
  service: "Deep Clean",
  hours: "4 h",
  address: "88 Grand St, 11211",
  area: "Williamsburg",
  access: "Lockbox on the side gate, code 2468.",
  addOns: [],
  client: "Dev",
  phone: "(347) 555-0110",
  crew: [
    { name: "You", confirmed: true },
    { name: "Maria L.", confirmed: true },
  ],
};

const tuesday: Job = {
  ...morning,
  id: "lake",
  at: "2026-11-03T15:00:00Z",
  day: "Tomorrow",
  time: "10:00 AM",
  until: "1:00 PM",
  address: "7 Lake Rd, 11530",
  area: "Garden City",
  access: null,
  addOns: ["Inside the fridge", "Windows"],
  client: "Priya",
  phone: null,
};

const thursday: Job = {
  ...afternoon,
  id: "park",
  at: "2026-11-05T23:00:00Z",
  day: "Thu, Nov 5",
  time: "6:00 PM",
  until: "9:00 PM",
  service: "Office Clean",
  hours: "3 h",
  address: "250 Park Ave S, Fl 6, 10003",
  area: "Gramercy",
  access: "Front desk signs you in. Ask for Priya.",
  client: "Priya",
  phone: null,
  offered: true,
  crew: [
    { name: "You", confirmed: false },
    { name: "Maria L.", confirmed: true },
  ],
};

const open: Open[] = [
  {
    id: "o1",
    at: "2026-11-04T14:00:00Z",
    day: "Wed, Nov 4",
    time: "9:00 AM",
    service: "Move-out Clean",
    hours: "5 h",
    area: "11101",
    crew: "2 Cleaners",
  },
  {
    id: "o2",
    at: "2026-11-06T18:00:00Z",
    day: "Fri, Nov 6",
    time: "1:00 PM",
    service: "Standard Clean",
    hours: "2.5 h",
    area: "11375",
    crew: "Just you",
  },
];

const visit: Job = {
  ...morning,
  id: "visit",
  at: "2026-11-02T15:00:00Z",
  time: "10:00 AM",
  until: "10:30 AM",
  service: "Site Visit",
  hours: "30 min",
  address: "19 Bedford Ave, 11222",
  area: "Greenpoint",
  access: "Ring the shop bell.",
  addOns: [],
  client: "Northwind Studio",
  visit: true,
};

const cases: CleanerCase[] = [
  {
    key: "1",
    name: "Today, before the first Job",
    jobs: [morning, afternoon, tuesday, thursday],
    open,
  },
  {
    key: "2",
    name: "On site now",
    jobs: [
      {
        ...afternoon,
        time: "9:00 AM",
        until: "1:00 PM",
        at: morning.at,
        started: true,
      },
      tuesday,
    ],
    open: [],
  },
  {
    key: "3",
    name: "An offer to answer",
    jobs: [
      { ...thursday, day: "Wed, Nov 4" },
      { ...tuesday, day: "Fri, Nov 6" },
    ],
    open: open.slice(0, 1),
  },
  { key: "4", name: "New: nothing yet", jobs: [], open: [] },
  {
    key: "5",
    name: "A Site Visit today",
    jobs: [visit, { ...afternoon, time: "1:00 PM", until: "5:00 PM" }],
    open,
  },
];

const actionLayouts = [
  { key: "A", name: "Action cards" },
  { key: "B", name: "Bar at the foot" },
];

// ---- the page ----

export function CleanerPrototype() {
  const s = useSearch({ strict: false }) as {
    case?: string;
    page?: string;
    job?: string;
    actions?: string;
  };
  const key = s.case ?? "1";
  const page = s.page ?? "jobs";
  const actions = s.actions ?? "A";
  const navigate = useNavigate();
  const go = (search: Partial<typeof s>) =>
    navigate({
      to: "/prototype/cleaner",
      search: { case: key, page, job: s.job, actions, ...search } as never,
    });
  const c = cases.find((x) => x.key === key) ?? cases[0]!;
  const job = c.jobs.find((j) => j.id === s.job);
  const offers = page === "offers";
  const hrefTo = (p: string) =>
    linkTo({
      to: "/prototype/cleaner",
      search: { case: key, page: p } as never,
    });
  const offered = c.jobs.filter((j) => j.offered).length;

  const nav: NavItem[] = [
    {
      href: hrefTo("jobs"),
      label: "Your Jobs",
      icon: CalendarDays,
      isCurrent: !offers,
    },
    {
      href: hrefTo("offers"),
      label:
        offered + c.open.length > 0
          ? `Offers (${offered + c.open.length})`
          : "Offers",
      icon: Inbox,
      isCurrent: offers,
    },
  ];

  return (
    <AppLayout
      area="Cleaner"
      nav={nav}
      account={<span className="text-sm text-fg-muted">Maria Lopez</span>}
    >
      {job ? (
        <JobPage
          job={job}
          actions={actions}
          back={{ label: offers ? "Offers" : "Your Jobs", href: hrefTo(page) }}
        />
      ) : offers ? (
        <OffersPage c={c} openJob={(id) => go({ job: id })} />
      ) : (
        <HomePage c={c} openJob={(id) => go({ job: id })} />
      )}
      {job && (
        <PrototypeSwitcher
          variants={actionLayouts}
          current={actions}
          onChange={(k) => go({ actions: k })}
          keys={["ArrowUp", "ArrowDown"]}
          className="bottom-56 md:bottom-36"
        />
      )}
      <PrototypeSwitcher
        variants={cases.map((x) => ({ key: x.key, name: x.name }))}
        current={c.key}
        onChange={(k) => go({ case: k, job: undefined })}
        className={job ? "bottom-40 md:bottom-20" : undefined}
      />
    </AppLayout>
  );
}

// ---- Your Jobs: only theirs ----

const mapsLink = (address: string) =>
  `https://maps.google.com/?q=${encodeURIComponent(address)}`;

function HomePage({
  c,
  openJob,
}: {
  c: CleanerCase;
  openJob: (id: string) => void;
}) {
  const theirs = c.jobs.filter((j) => !j.offered && !j.done);
  const [next, ...rest] = theirs;
  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Your Jobs</Heading>
      {next ? (
        <NextUp job={next} openJob={openJob} />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Nothing booked for you yet"
          description="Jobs you're on show here, the next one first. See Offers for places you can take."
        />
      )}
      {rest.length > 0 && (
        <Section title="Coming up">
          <JobRows jobs={rest} openJob={openJob} label="Coming up" />
        </Section>
      )}
    </div>
  );
}

// the next Job, large: when first, then where, and the two things wanted on
// the way
function NextUp({ job, openJob }: { job: Job; openJob: (id: string) => void }) {
  return (
    <Section title={job.started ? "Now" : "Next up"}>
      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <DateTile date={job.at} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-3xl font-semibold text-fg tabular-nums">
              {job.time}
            </p>
            <p className="text-sm text-fg-muted">
              {job.day}, until about {job.until}
            </p>
            <p className="mt-2 text-lg font-semibold text-fg">{job.address}</p>
            <p className="text-fg-muted">
              {job.service} · {job.hours} on site
              {job.crew.length > 1 &&
                ` · with ${job.crew
                  .filter((m) => m.name !== "You")
                  .map((m) => m.name)
                  .join(", ")}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <a
              className={buttonStyles({ variant: "secondary" })}
              href={mapsLink(job.address)}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation aria-hidden size={18} />
              Directions
            </a>
            <Button onPress={() => openJob(job.id)}>
              {job.started
                ? "Complete it"
                : job.visit
                  ? "Open visit"
                  : "Open Job"}
            </Button>
          </div>
        </div>
      </Card>
    </Section>
  );
}

// a row each, its day and time first
function JobRows({
  jobs,
  openJob,
  label,
}: {
  jobs: Job[];
  openJob: (id: string) => void;
  label: string;
}) {
  return (
    <List aria-label={label} onAction={(id) => openJob(String(id))}>
      {jobs.map((j) => (
        <ListItem
          key={j.id}
          id={j.id}
          start={<DateTile date={j.at} size="sm" />}
          title={`${j.day}, ${j.time}`}
          description={`${j.address} · ${j.service}, ${j.hours}`}
          end={
            j.visit ? (
              <StatusBadge tone="info">Site Visit</StatusBadge>
            ) : j.offered ? (
              <StatusBadge tone="warning">Offered</StatusBadge>
            ) : undefined
          }
        />
      ))}
    </List>
  );
}

// ---- Offers: places that aren't theirs yet ----

function OffersPage({
  c,
  openJob,
}: {
  c: CleanerCase;
  openJob: (id: string) => void;
}) {
  const offered = c.jobs.filter((j) => j.offered);
  return (
    <div className="flex flex-col gap-6">
      <Heading level={1}>Offers</Heading>
      {offered.length > 0 && (
        <Section
          title="Offered to you"
          description="The Office picked you for these. Confirm, or let them go to someone else."
        >
          <JobRows jobs={offered} openJob={openJob} label="Offered to you" />
        </Section>
      )}
      <Section
        title="Open to you"
        description="Places on Jobs in the next 7 days, when you're free. The first to confirm takes each."
      >
        {c.open.length > 0 ? (
          <OpenRows places={c.open} />
        ) : (
          <EmptyState
            headingLevel={3}
            icon={Inbox}
            title="Nothing open to you right now"
            description="When a Job near you needs someone, it shows here."
          />
        )}
      </Section>
    </div>
  );
}

function OpenRows({ places }: { places: Open[] }) {
  return (
    <List aria-label="Open to you" onAction={() => {}}>
      {places.map((p) => (
        <ListItem
          key={p.id}
          id={p.id}
          start={<DateTile date={p.at} size="sm" />}
          title={`${p.day}, ${p.time}`}
          description={`${p.service}, ${p.hours} · ${p.crew} · ZIP ${p.area}`}
        />
      ))}
    </List>
  );
}

// ---- a Job ----

function JobPage({
  job,
  actions,
  back,
}: {
  job: Job;
  actions: string;
  back: { label: string; href: ReturnType<typeof linkTo> };
}) {
  const others = job.crew.filter((m) => m.name !== "You");
  const unconfirmed = others.filter((m) => !m.confirmed);

  // what can be done now, the main one last
  const doNow: { title: string; text: ReactNode; buttons: ReactNode }[] =
    job.offered
      ? []
      : job.started
        ? [
            {
              title: "Couldn't get in?",
              text: <p>Tell us what happened. We'll let the Client know.</p>,
              buttons: (
                <Button variant="danger-text">
                  <DoorClosed aria-hidden size={18} />
                  Record No Access
                </Button>
              ),
            },
            {
              title: "Finished?",
              text: (
                <p>
                  Say how the home was, and anything different from the Quote.
                  The Office sorts out any price change.
                </p>
              ),
              buttons: <Button>Complete Job</Button>,
            },
          ]
        : [
            {
              title: "Can't make it?",
              text: (
                <p>
                  You can release your place until 48 hours before. It opens to
                  the other Cleaners.
                </p>
              ),
              buttons: <Button variant="secondary">Release my place</Button>,
            },
          ];

  return (
    <div className={`flex flex-col gap-6 ${actions === "B" ? "pb-28" : ""}`}>
      <div className="flex flex-col gap-4">
        <Breadcrumbs trail={[back, { label: `${job.day}, ${job.time}` }]} />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{job.service}</Heading>
          {job.visit ? (
            <StatusBadge tone="info">Site Visit</StatusBadge>
          ) : job.offered ? (
            <StatusBadge tone="warning">Offered</StatusBadge>
          ) : job.started ? (
            <StatusBadge tone="info">Now</StatusBadge>
          ) : (
            <StatusBadge tone="success">Confirmed</StatusBadge>
          )}
        </div>
      </div>

      {job.offered && (
        <Notice tone="warning" action={<Button variant="text">Answer</Button>}>
          <p>
            <strong>You're offered a place.</strong> Can you make it? Confirm
            it, or let it go to someone else.
          </p>
        </Notice>
      )}
      {job.started && unconfirmed.length > 0 && (
        <Notice tone="warning">
          Not everyone has confirmed, so it can't be Completed yet. Please call
          the Office.
        </Notice>
      )}

      <Section title={job.visit ? "Visit details" : "Job details"}>
        <Card>
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <IconTile icon={CalendarClock} size="lg" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-fg-muted">
                  {job.day}, until about {job.until}
                </p>
                <p className="text-xl font-semibold text-fg">{job.time}</p>
                <p className="text-fg-muted">{job.address}</p>
                <a
                  className="self-start font-semibold text-primary underline-offset-2 hover:underline"
                  href={mapsLink(job.address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Directions
                </a>
              </div>
            </div>
            <div className="flex gap-3 rounded-md bg-surface-sunken p-4">
              <KeyRound
                aria-hidden
                size={20}
                className="mt-0.5 shrink-0 text-fg-muted"
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-fg">How to get in</p>
                <p className="text-fg">
                  {job.offered
                    ? "Shown once you've confirmed."
                    : (job.access ??
                      "None given. Call the Client when you arrive.")}
                </p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact
                icon={Clock}
                label="On site"
                value={`About ${job.hours}`}
                line="On site"
              />
              {job.visit ? (
                <Fact
                  icon={Eye}
                  label="What for"
                  value="See it before it's quoted"
                  line="Nothing to complete here"
                />
              ) : (
                <Fact
                  icon={CirclePlus}
                  label="Add-ons"
                  value={job.addOns.length > 0 ? job.addOns.join(", ") : "None"}
                />
              )}
              <Fact
                icon={Users}
                label="Crew"
                value={
                  others.length === 0
                    ? "Just you"
                    : `You and ${others.map((m) => m.name).join(", ")}`
                }
                line={
                  unconfirmed.length > 0
                    ? `${unconfirmed.map((m) => m.name).join(", ")} not confirmed yet`
                    : "Crew"
                }
              />
              <Fact
                icon={Phone}
                label="Client"
                value={
                  job.phone ? (
                    <a
                      className="font-semibold text-primary"
                      href={`tel:${job.phone}`}
                    >
                      {job.client}, {job.phone}
                    </a>
                  ) : (
                    job.client
                  )
                }
                line={
                  job.phone
                    ? "Client: tap to call"
                    : "Their phone shows on the day"
                }
              />
            </dl>
          </div>
        </Card>
      </Section>

      {actions === "A" &&
        doNow.map((a) => (
          <Section key={a.title} title={a.title}>
            <Card>
              <ActionRow actions={a.buttons}>{a.text}</ActionRow>
            </Card>
          </Section>
        ))}

      {actions === "B" && doNow.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-10 border-t border-border bg-surface px-4 py-3 shadow-raised md:bottom-0 md:left-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
            {doNow.map((a) => (
              <span key={a.title}>{a.buttons}</span>
            ))}
          </div>
        </div>
      )}

      {job.offered && (
        <Section title="Your place">
          <Card>
            <ActionRow
              actions={
                <>
                  <Button variant="secondary">Not for me</Button>
                  <Button>Confirm my place</Button>
                </>
              }
            >
              <p>
                Confirm it and it's yours. The address, how to get in and the
                Client's details stay with it.
              </p>
            </ActionRow>
          </Card>
        </Section>
      )}
      {job.visit && (
        <Notice>
          <span className="inline-flex items-center gap-2">
            <MapPin aria-hidden size={16} />
            You're seeing the place before it's quoted. Tell the Office what you
            found; there's nothing to complete here.
          </span>
        </Notice>
      )}
    </div>
  );
}
