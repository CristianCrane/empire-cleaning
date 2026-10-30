// PROTOTYPE: throwaway. Layouts for the Client's Home (?variant=B..D), for
// the UX pass (#96). Lives only on prototype-portal-home.
import type { Key, ReactNode } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  MapPin,
  MessageCircleQuestion,
  Receipt,
  Repeat,
  Sparkles,
} from "lucide-react";
import type {
  BillSummary,
  ClientJob,
  ClientPastJob,
  ClientSiteVisit,
  PropertyView,
  QuoteSummary,
  ServicePlanSummary,
} from "@empire-cleaning/models";
import {
  Button,
  ButtonLink,
  Card,
  Heading,
  IconTile,
  List,
  ListItem,
  Notice,
  Section,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { QuoteIcon } from "../icons.ts";
import {
  addressOf,
  formatDateTime,
  formatHours,
  formatMinutes,
  formatMoney,
  planName,
  propertySummary,
} from "../format.ts";
import { BillStatusBadge, billLine } from "../BillParts.tsx";
import { PlanStatusBadge } from "../PlanParts.tsx";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { PortalHome, quoteLine } from "./PortalHome.tsx";

export const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "Sections, what needs you first" },
  { key: "C", name: "Next clean + Tabs" },
  { key: "D", name: "Needs you + Coming up + history Tabs" },
];

export type HomeData = ReturnType<typeof useHomeData>;

const inDays = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const isoDay = (days: number) => inDays(days, 12).slice(0, 10);

// fills the lists a seeded Client lacks, so every part of Home shows
export function useHomeData() {
  const real = useLoaderData({ from: "/portal/" });
  const home: PropertyView =
    real.client.properties[0] ??
    ({
      id: "p1",
      kind: "residential",
      type: "apartment",
      street: "12 Elm St",
      unit: "4B",
      postcode: "11375",
      bedrooms: 2,
      bathrooms: 1,
    } as unknown as PropertyView);
  const at = {
    id: home.id,
    street: home.street,
    unit: home.unit,
    postcode: home.postcode,
  };
  const job = (
    id: string,
    days: number,
    hour: number,
    serviceName: string,
  ): ClientJob => ({
    id,
    startsAt: inDays(days, hour),
    serviceName,
    crewSize: 2,
    hoursOnSite: 2.5,
    property: at,
  });
  const past = (
    id: string,
    days: number,
    over: Partial<ClientPastJob> = {},
  ): ClientPastJob => ({
    ...job(id, days, 9, "Standard Clean"),
    completedAt: inDays(days, 12),
    totalCents: 18450,
    unpaid: false,
    awaitingAnswer: 0,
    ...over,
  });
  const bill = (
    id: string,
    n: number,
    weeksAgo: number,
    over: Partial<BillSummary>,
  ): BillSummary => ({
    id,
    number: `EC-0000${n}`,
    client: {
      id: real.client.id,
      name: real.client.name,
    } as BillSummary["client"],
    weekStart: isoDay(-7 * weeksAgo - 6),
    weekEnd: isoDay(-7 * weeksAgo),
    madeAt: inDays(-7 * weeksAgo + 1, 6),
    payment: "on_page",
    dueOn: isoDay(-7 * weeksAgo + 15),
    status: "paid",
    totalCents: 36900,
    taxCents: 2900,
    unpaid: null,
    paidAt: inDays(-7 * weeksAgo + 3, 10),
    paidVia: "page",
    ...over,
  });
  const plans: ServicePlanSummary[] = real.plans.length
    ? real.plans
    : [
        {
          id: "plan1",
          status: "active",
          recurrence: "fortnightly",
          days: [{ startsAt: inDays(4, 9), serviceName: "Standard Clean" }],
          property: at,
          nextStartsAt: inDays(4, 9),
        } as ServicePlanSummary,
      ];
  const quotes: QuoteSummary[] = real.quotes.length
    ? real.quotes
    : [
        {
          id: "q1",
          kind: "one_off",
          status: "sent",
          origin: "client",
          asked: null,
          service: { key: "deep", name: "Deep Clean" },
          client: { id: real.client.id, name: real.client.name },
          property: home,
          homePlanId: null,
          headlineTotalCents: 39104,
          plan: null,
          proposedStartsAt: inDays(9, 10),
          sentAt: inDays(-1, 15),
          expiresAt: inDays(6, 23),
          drafting: false,
          siteVisit: null,
          createdAt: inDays(-3, 11),
        } as unknown as QuoteSummary,
        {
          id: "q2",
          kind: "plan",
          status: "accepted",
          origin: "client",
          asked: null,
          service: { key: "standard", name: "Standard Clean" },
          client: { id: real.client.id, name: real.client.name },
          property: home,
          homePlanId: "plan1",
          headlineTotalCents: 18450,
          plan: {
            recurrence: "fortnightly",
            days: [{ startsAt: inDays(-38, 9), serviceName: "Standard Clean" }],
          },
          proposedStartsAt: inDays(-38, 9),
          sentAt: inDays(-45, 15),
          expiresAt: null,
          drafting: false,
          siteVisit: null,
          createdAt: inDays(-47, 11),
        } as unknown as QuoteSummary,
      ];
  return {
    client: {
      ...real.client,
      properties: real.client.properties.length
        ? real.client.properties
        : [home],
    },
    plans,
    quotes,
    jobs: real.jobs.length
      ? real.jobs
      : [
          job("j1", 4, 9, "Standard Clean"),
          job("j2", 9, 10, "Deep Clean"),
          job("j3", 18, 9, "Standard Clean"),
        ],
    pastJobs: real.pastJobs.length
      ? real.pastJobs
      : [
          past("pj1", -10, { awaitingAnswer: 1, totalCents: 21450 }),
          past("pj2", -24),
          past("pj3", -38),
        ],
    siteVisits: real.siteVisits.length
      ? real.siteVisits
      : ([
          {
            id: "sv1",
            startsAt: inDays(2, 14),
            minutes: 30,
            property: at,
            visitorName: "Cris Crane",
          },
        ] satisfies ClientSiteVisit[]),
    bills: real.bills.length
      ? real.bills
      : [
          bill("b1", 41, 0, {
            status: "due",
            paidAt: null,
            paidVia: null,
            totalCents: 21450,
          }),
          bill("b2", 37, 2, {}),
          bill("b3", 33, 4, {}),
        ],
  };
}

export function PortalHomePrototype() {
  const { variant = "A" } = useSearch({ from: "/portal/" }) as {
    variant?: string;
  };
  const navigate = useNavigate();
  const data = useHomeData();
  const page =
    variant === "B" ? (
      <SectionsHome data={data} />
    ) : variant === "C" ? (
      <NextCleanHome data={data} />
    ) : variant === "D" ? (
      <NeedsYouHome data={data} />
    ) : (
      <PortalHome data={data} />
    );
  return (
    <>
      {page}
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) =>
          navigate({ to: "/portal", search: { variant: key } as never })
        }
      />
    </>
  );
}

// ---- shared ----

const useOpen = () => {
  const navigate = useNavigate();
  return {
    job: (id: Key) =>
      navigate({ to: "/portal/jobs/$jobId", params: { jobId: String(id) } }),
    bill: (id: Key) =>
      navigate({ to: "/portal/bills/$billId", params: { billId: String(id) } }),
    plan: (id: Key) =>
      navigate({ to: "/portal/plans/$planId", params: { planId: String(id) } }),
    quote: (id: Key) =>
      navigate({
        to: "/portal/quotes/$quoteId",
        params: { quoteId: String(id) },
      }),
  };
};

function Header({ data }: { data: HomeData }) {
  const [firstName] = data.client.name.split(" ");
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <Heading level={1}>Welcome, {firstName}</Heading>
      <ButtonLink href={linkTo({ to: "/portal/request" })}>
        <QuoteIcon aria-hidden size={18} />
        Request a Quote
      </ButtonLink>
    </div>
  );
}

// what's waiting on the Client: a Quote to answer, a Bill to pay, an extra
// to agree to
type Todo = {
  id: string;
  title: string;
  description: string;
  icon: typeof Receipt;
  open: () => void;
};
const todosOf = (data: HomeData, open: ReturnType<typeof useOpen>): Todo[] => [
  ...data.quotes
    .filter((q) => q.status === "sent")
    .map((q) => ({
      id: `q-${q.id}`,
      title: "Answer your Quote",
      description: quoteLine(q),
      icon: QuoteIcon as typeof Receipt,
      open: () => open.quote(q.id),
    })),
  ...data.bills
    .filter(
      (b) =>
        b.unpaid ||
        (b.status === "due" && b.payment === "on_page" && b.totalCents > 0),
    )
    .map((b) => ({
      id: `b-${b.id}`,
      title: `Pay Bill ${b.number}`,
      description: billLine(b),
      icon: Receipt,
      open: () => open.bill(b.id),
    })),
  ...data.pastJobs
    .filter((j) => j.awaitingAnswer > 0)
    .map((j) => ({
      id: `j-${j.id}`,
      title:
        j.awaitingAnswer === 1
          ? "Agree to an extra"
          : `Agree to ${j.awaitingAnswer} extras`,
      description: `${j.serviceName} · ${formatDateTime(j.startsAt)}`,
      icon: MessageCircleQuestion,
      open: () => open.job(j.id),
    })),
];

// Site Visits and Jobs in one list, soonest first
type Coming = {
  id: string;
  startsAt: string;
  title: string;
  description: string;
  icon: typeof Receipt;
  badge: ReactNode;
  jobId?: string;
};
const comingOf = (data: HomeData): Coming[] =>
  [
    ...data.siteVisits.map((v) => ({
      id: `v-${v.id}`,
      startsAt: v.startsAt,
      title: `Site Visit · ${formatDateTime(v.startsAt)}`,
      description: `${addressOf(v.property)} · ${v.visitorName} visits for about ${formatMinutes(v.minutes)}`,
      icon: MapPin,
      badge: <StatusBadge tone="info">Booked</StatusBadge>,
    })),
    ...data.jobs.map((j) => ({
      id: `j-${j.id}`,
      jobId: j.id,
      startsAt: j.startsAt,
      title: formatDateTime(j.startsAt),
      description: `${j.serviceName} · ${addressOf(j.property)} · about ${formatHours(j.hoursOnSite)}`,
      icon: Sparkles,
      badge: <StatusBadge tone="info">Booked</StatusBadge>,
    })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

const pastBadge = (job: ClientPastJob) =>
  job.unpaid ? (
    <StatusBadge tone="danger">Unpaid</StatusBadge>
  ) : job.awaitingAnswer > 0 ? (
    <StatusBadge tone="warning">Needs your answer</StatusBadge>
  ) : (
    <StatusBadge tone="success">Done</StatusBadge>
  );

function ComingList({ items, label }: { items: Coming[]; label: string }) {
  const open = useOpen();
  return (
    <List
      aria-label={label}
      renderEmptyState={() => <Empty>Nothing booked just now.</Empty>}
    >
      {items.map((c) => (
        <ListItem
          key={c.id}
          id={c.id}
          start={<IconTile icon={c.icon} tone="info" />}
          title={c.title}
          description={c.description}
          end={c.badge}
          onAction={c.jobId ? () => open.job(c.jobId!) : undefined}
        />
      ))}
    </List>
  );
}

function PlansList({ plans }: { plans: ServicePlanSummary[] }) {
  const open = useOpen();
  return (
    <List aria-label="Your Service Plans" onAction={open.plan}>
      {plans.map((plan) => (
        <ListItem
          key={plan.id}
          id={plan.id}
          title={planName(plan)}
          description={[
            addressOf(plan.property),
            plan.nextStartsAt
              ? `Next: ${formatDateTime(plan.nextStartsAt)}`
              : "No clean booked just now",
          ].join(" · ")}
          end={<PlanStatusBadge status={plan.status} />}
        />
      ))}
    </List>
  );
}

function PastList({ jobs }: { jobs: ClientPastJob[] }) {
  const open = useOpen();
  return (
    <List
      aria-label="Your past Jobs"
      onAction={open.job}
      renderEmptyState={() => <Empty>No cleans yet.</Empty>}
    >
      {jobs.map((job) => (
        <ListItem
          key={job.id}
          id={job.id}
          title={formatDateTime(job.startsAt)}
          description={[
            job.serviceName,
            addressOf(job.property),
            formatMoney(job.totalCents),
          ].join(" · ")}
          end={pastBadge(job)}
        />
      ))}
    </List>
  );
}

function BillsList({ bills }: { bills: BillSummary[] }) {
  const open = useOpen();
  return (
    <List
      aria-label="Your Bills"
      onAction={open.bill}
      renderEmptyState={() => <Empty>No Bills yet.</Empty>}
    >
      {bills.map((bill) => (
        <ListItem
          key={bill.id}
          id={bill.id}
          title={`Bill ${bill.number}`}
          description={billLine(bill)}
          end={<BillStatusBadge bill={bill} />}
        />
      ))}
    </List>
  );
}

function QuotesList({ quotes }: { quotes: QuoteSummary[] }) {
  const open = useOpen();
  return (
    <List
      aria-label="Your Quotes"
      onAction={open.quote}
      renderEmptyState={() => <Empty>No Quotes yet.</Empty>}
    >
      {quotes.map((quote) => (
        <ListItem
          key={quote.id}
          id={quote.id}
          title={addressOf(quote.property)}
          description={quoteLine(quote)}
          end={
            quote.siteVisit === "booked" ? (
              <StatusBadge tone="info">Site Visit booked</StatusBadge>
            ) : (
              <QuoteStatusBadge status={quote.status} />
            )
          }
        />
      ))}
    </List>
  );
}

function HomesList({ homes }: { homes: PropertyView[] }) {
  return (
    <List aria-label="Your homes">
      {homes.map((home) => (
        <ListItem
          key={home.id}
          id={home.id}
          title={addressOf(home)}
          description={propertySummary(home)}
        />
      ))}
    </List>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="p-6 text-center text-fg-muted">{children}</p>
);

// ---- B: the patterns applied: Sections, what needs the Client first ----

function SectionsHome({ data }: { data: HomeData }) {
  const open = useOpen();
  const todos = todosOf(data, open);
  return (
    <div className="flex flex-col gap-8">
      <Header data={data} />
      {todos.map((t) => (
        <Notice
          key={t.id}
          tone="warning"
          action={
            <Button variant="text" onPress={t.open}>
              {t.title}
            </Button>
          }
        >
          {t.description}
        </Notice>
      ))}
      <Section
        title="Coming up"
        description="We email a reminder the day before each clean."
      >
        <ComingList items={comingOf(data)} label="Coming up" />
      </Section>
      {data.plans.length > 0 && (
        <Section
          title={
            data.plans.length === 1 ? "Your Service Plan" : "Your Service Plans"
          }
        >
          <PlansList plans={data.plans} />
        </Section>
      )}
      <Section
        title="Your Quotes"
        description="We email your Quote, usually within a working day."
      >
        <QuotesList quotes={data.quotes} />
      </Section>
      {data.bills.length > 0 && (
        <Section
          title="Your Bills"
          description="Each week's cleans on one Bill, made the following Monday."
        >
          <BillsList bills={data.bills} />
        </Section>
      )}
      {data.pastJobs.length > 0 && (
        <Section title="Your past cleans" description="Each with its receipt.">
          <PastList jobs={data.pastJobs} />
        </Section>
      )}
      <Section title="Your homes">
        <HomesList homes={data.client.properties} />
      </Section>
    </div>
  );
}

// ---- C: the next clean up top, everything else in Tabs ----

function NextCleanHome({ data }: { data: HomeData }) {
  const open = useOpen();
  const todos = todosOf(data, open);
  const [next, ...later] = data.jobs;
  return (
    <div className="flex flex-col gap-6">
      <Header data={data} />
      {todos.map((t) => (
        <Notice
          key={t.id}
          tone="warning"
          action={
            <Button variant="text" onPress={t.open}>
              {t.title}
            </Button>
          }
        >
          {t.description}
        </Notice>
      ))}
      {next ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <IconTile icon={CalendarCheck} tone="info" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm font-semibold text-fg-muted">
                Your next clean
              </p>
              <p className="text-2xl font-semibold text-fg">
                {formatDateTime(next.startsAt)}
              </p>
              <p className="text-fg-muted">
                {next.serviceName} · {addressOf(next.property)} ·{" "}
                {next.crewSize} Cleaners for about{" "}
                {formatHours(next.hoursOnSite)}
              </p>
            </div>
            <Button variant="secondary" onPress={() => open.job(next.id)}>
              See the Job
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-fg-muted">No clean booked just now.</p>
        </Card>
      )}
      <Tabs defaultSelectedKey="coming">
        <TabList aria-label="Your cleaning">
          <Tab id="coming" count={later.length + data.siteVisits.length}>
            Coming up
          </Tab>
          <Tab id="past" count={data.pastJobs.length}>
            Past cleans
          </Tab>
          <Tab id="bills" count={data.bills.length}>
            Bills
          </Tab>
          <Tab id="quotes" count={data.quotes.length}>
            Quotes
          </Tab>
          <Tab id="plans" count={data.plans.length}>
            Plans
          </Tab>
          <Tab id="homes" count={data.client.properties.length}>
            Homes
          </Tab>
        </TabList>
        <TabPanel id="coming">
          <ComingList
            items={comingOf({ ...data, jobs: later })}
            label="Coming up"
          />
        </TabPanel>
        <TabPanel id="past">
          <PastList jobs={data.pastJobs} />
        </TabPanel>
        <TabPanel id="bills">
          <BillsList bills={data.bills} />
        </TabPanel>
        <TabPanel id="quotes">
          <QuotesList quotes={data.quotes} />
        </TabPanel>
        <TabPanel id="plans">
          <PlansList plans={data.plans} />
        </TabPanel>
        <TabPanel id="homes">
          <HomesList homes={data.client.properties} />
        </TabPanel>
      </Tabs>
    </div>
  );
}

// ---- D: a to-do list like the Office's Today, what's coming, then history ----

function NeedsYouHome({ data }: { data: HomeData }) {
  const open = useOpen();
  const todos = todosOf(data, open);
  return (
    <div className="flex flex-col gap-8">
      <Header data={data} />
      {todos.length > 0 && (
        <Section title="Needs you">
          <List aria-label="Needs you">
            {todos.map((t) => (
              <ListItem
                key={t.id}
                id={t.id}
                start={<IconTile icon={t.icon} tone="warning" />}
                title={t.title}
                description={t.description}
                onAction={t.open}
              />
            ))}
          </List>
        </Section>
      )}
      <Section
        title="Coming up"
        description="We email a reminder the day before each clean."
        actions={
          data.plans.length > 0 && (
            <ButtonLink
              variant="text"
              href={linkTo({
                to: "/portal/plans/$planId",
                params: { planId: data.plans[0]!.id },
              })}
            >
              <Repeat aria-hidden size={18} />
              Your Service Plan
            </ButtonLink>
          )
        }
      >
        <ComingList items={comingOf(data)} label="Coming up" />
      </Section>
      <Section title="Your history">
        <Tabs defaultSelectedKey="past">
          <TabList aria-label="Your history">
            <Tab id="past" count={data.pastJobs.length}>
              <CalendarDays aria-hidden size={16} /> Cleans
            </Tab>
            <Tab id="bills" count={data.bills.length}>
              <Receipt aria-hidden size={16} /> Bills
            </Tab>
            <Tab id="quotes" count={data.quotes.length}>
              <ClipboardCheck aria-hidden size={16} /> Quotes
            </Tab>
          </TabList>
          <TabPanel id="past">
            <PastList jobs={data.pastJobs} />
          </TabPanel>
          <TabPanel id="bills">
            <BillsList bills={data.bills} />
          </TabPanel>
          <TabPanel id="quotes">
            <QuotesList quotes={data.quotes} />
          </TabPanel>
        </Tabs>
      </Section>
      <Section title="Your homes">
        <HomesList homes={data.client.properties} />
      </Section>
    </div>
  );
}
