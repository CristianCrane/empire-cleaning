import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import { Receipt, Sparkles } from "lucide-react";
import type {
  ClientPastJob,
  ClientSiteVisit,
  ClientUpcomingJob,
} from "@empire-cleaning/models";
import { catalog } from "@empire-cleaning/models";
import {
  Button,
  DateTile,
  EmptyState,
  Heading,
  List,
  ListItem,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@empire-cleaning/ui";
import {
  addressOf,
  formatHours,
  formatMinutes,
  dayOfInstant,
} from "../format.ts";
import { JobStatusBadge } from "../JobBadges.tsx";
import { type Said, useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    about: (length: string) => `about ${length}`,
    moveAsked: "Move asked",
    siteVisit: "Site visit",
    visit: (visitor: string, length: string) =>
      `${visitor}, about ${length}, free`,
    unpaid: "Unpaid",
    needsOk: "Needs your OK",
    fee: (amount: string) => `${amount} fee`,
    noCharge: "No charge",
    yourCleans: "Your cleans",
    upcoming: "Upcoming",
    past: "Past",
    nothingBooked: "Nothing booked",
    showsHere: "Your next clean shows here once it's booked.",
    noneYet: "No cleans yet",
    eachShows: "Each clean shows here once it's done, with its receipt.",
    showMore: "Show more",
  },
  es: {
    about: (length: string) => `unas ${length}`,
    moveAsked: "Reprogramación pedida",
    siteVisit: "Visita previa",
    visit: (visitor: string, length: string) =>
      `${visitor}, unos ${length}, gratis`,
    unpaid: "Sin pagar",
    needsOk: "Necesita su aprobación",
    fee: (amount: string) => `cargo de ${amount}`,
    noCharge: "Sin cargo",
    yourCleans: "Sus limpiezas",
    upcoming: "Próximas",
    past: "Pasadas",
    nothingBooked: "Nada reservado",
    showsHere: "Su próxima limpieza aparecerá aquí cuando esté reservada.",
    noneYet: "Aún no hay limpiezas",
    eachShows:
      "Cada limpieza aparecerá aquí cuando esté terminada, con su recibo.",
    showMore: "Mostrar más",
  },
});
type T = Said & { w: (typeof words)["en"] };

// The Client's cleans: Upcoming (with their Site Visits) and Past, each by
// month, a date tile leading each row. Only what isn't plain gets a badge:
// a clean booked or done needs none. (UX pass, #96)

export const cleansTabs = ["upcoming", "past"] as const;
type CleansTab = (typeof cleansTabs)[number];
export type CleansSearch = { tab?: CleansTab };

// past cleans shown at a time
const PAGE = 10;

// a row's worth: its date, what it is, a line under it, and where it opens
type Row = {
  id: string;
  startsAt: string;
  title: string;
  line: string;
  badge?: ReactNode;
  jobId?: string;
};

// "9:00 AM · 12 Elm St · $184.50": the home only when there's more than one
const lineOf = (parts: (string | false)[]) => parts.filter(Boolean).join(" · ");

const upcomingRow =
  (t: T, homes: number) =>
  (job: ClientUpcomingJob): Row => ({
    id: job.id,
    startsAt: job.startsAt,
    title: job.serviceName,
    line: lineOf([
      t.formatTime(job.startsAt),
      homes > 1 && addressOf(job.property),
      t.w.about(formatHours(job.hoursOnSite)),
    ]),
    badge: job.movingTo ? (
      <StatusBadge tone="info">{t.w.moveAsked}</StatusBadge>
    ) : undefined,
    jobId: job.id,
  });

const visitRow =
  (t: T, homes: number) =>
  (visit: ClientSiteVisit): Row => ({
    id: visit.id,
    startsAt: visit.startsAt,
    title: t.w.siteVisit,
    line: lineOf([
      t.formatTime(visit.startsAt),
      homes > 1 && addressOf(visit.property),
      t.w.visit(visit.visitorName, formatMinutes(visit.minutes)),
    ]),
  });

// what's not plain about a past clean, the most pressing first
const pastBadge = (t: T, job: ClientPastJob) => {
  if (job.unpaid) return <StatusBadge tone="danger">{t.w.unpaid}</StatusBadge>;
  if (job.awaitingAnswer > 0)
    return <StatusBadge tone="warning">{t.w.needsOk}</StatusBadge>;
  if (job.status === "no_access") return <JobStatusBadge status="no_access" />;
  if (job.status === "cancelled")
    return <StatusBadge>{t.cancelledLabel(job.skipped)}</StatusBadge>;
  return undefined;
};

const pastRow =
  (t: T, homes: number) =>
  (job: ClientPastJob): Row => ({
    id: job.id,
    startsAt: job.startsAt,
    title: job.serviceName,
    line: lineOf([
      t.formatTime(job.startsAt),
      homes > 1 && addressOf(job.property),
      job.status === "completed"
        ? t.formatMoney(job.totalCents)
        : job.feeCents > 0
          ? t.w.fee(t.formatMoney(job.feeCents))
          : t.w.noCharge,
    ]),
    badge: pastBadge(t, job),
    jobId: job.id,
  });

const byMonth = (t: T, rows: Row[]) => {
  const months: { month: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const month = t.formatMonth(dayOfInstant(row.startsAt));
    if (months.at(-1)?.month !== month) months.push({ month, rows: [] });
    months.at(-1)!.rows.push(row);
  }
  return months;
};

export function PortalCleans() {
  const { client, jobs, pastJobs, siteVisits } = useLoaderData({
    from: "/portal/cleans",
  });
  const search = useSearch({ from: "/portal/cleans" });
  const navigate = useNavigate();
  const [shown, setShown] = useState(PAGE);
  const homes = client.properties.length;
  const t = useSaid(words);
  const { w } = t;

  const upcoming = [
    ...jobs.map(upcomingRow(t, homes)),
    ...siteVisits.map(visitRow(t, homes)),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = pastJobs.map(pastRow(t, homes));
  // Upcoming, unless only Past has anything
  const tab =
    search.tab ??
    (upcoming.length === 0 && past.length > 0 ? "past" : "upcoming");

  const months = (rows: Row[], label: string) =>
    byMonth(t, rows).map(({ month, rows }) => (
      <section key={month} className="flex flex-col gap-2">
        <Heading level={2} size={4} className="text-fg-muted">
          {month}
        </Heading>
        <List aria-label={`${label}, ${month}`}>
          {rows.map((row) => (
            <ListItem
              key={row.id}
              id={row.id}
              start={<DateTile date={row.startsAt} size="sm" />}
              title={row.title}
              description={row.line}
              end={row.badge}
              onAction={
                row.jobId
                  ? () =>
                      void navigate({
                        to: "/portal/jobs/$jobId",
                        params: { jobId: row.jobId! },
                      })
                  : undefined
              }
            />
          ))}
        </List>
      </section>
    ));

  return (
    <div className="flex flex-col gap-6">
      <Heading level={1} inBar>
        {w.yourCleans}
      </Heading>
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) =>
          void navigate({
            to: "/portal/cleans",
            search: { tab: key as CleansTab },
            replace: true,
          })
        }
      >
        <TabList aria-label={w.yourCleans}>
          <Tab id="upcoming" count={upcoming.length}>
            {w.upcoming}
          </Tab>
          <Tab id="past" count={past.length}>
            {w.past}
          </Tab>
        </TabList>
        <TabPanel id="upcoming" className="flex flex-col gap-6">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={w.nothingBooked}
              description={w.showsHere}
            />
          ) : (
            months(upcoming, w.upcoming)
          )}
        </TabPanel>
        <TabPanel id="past" className="flex flex-col gap-6">
          {past.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={w.noneYet}
              description={w.eachShows}
            />
          ) : (
            <>
              {months(past.slice(0, shown), w.past)}
              {past.length > shown && (
                <Button
                  variant="secondary"
                  className="self-center"
                  onPress={() => setShown(shown + PAGE)}
                >
                  {w.showMore}
                </Button>
              )}
            </>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}
