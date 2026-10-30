import { useState, type ReactNode } from "react";
import { useLoaderData, useNavigate, useSearch } from "@tanstack/react-router";
import { Receipt, Sparkles } from "lucide-react";
import type {
  ClientPastJob,
  ClientSiteVisit,
  ClientUpcomingJob,
} from "@empire-cleaning/models";
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
  formatMoney,
  formatTime,
} from "../format.ts";

// The Client's cleans: Upcoming (with their Site Visits) and Past, each by
// month, a date tile leading each row. Only what isn't plain gets a badge:
// a clean booked or done needs none. (UX pass, #96)

export const cleansTabs = ["upcoming", "past"] as const;
export type CleansTab = (typeof cleansTabs)[number];
export type CleansSearch = { tab?: CleansTab };

// past cleans shown at a time
const PAGE = 10;

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "America/New_York",
});

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
  (homes: number) =>
  (job: ClientUpcomingJob): Row => ({
    id: job.id,
    startsAt: job.startsAt,
    title: job.serviceName,
    line: lineOf([
      formatTime(job.startsAt),
      homes > 1 && addressOf(job.property),
      `about ${formatHours(job.hoursOnSite)}`,
    ]),
    badge: job.movingTo ? (
      <StatusBadge tone="info">Move asked</StatusBadge>
    ) : undefined,
    jobId: job.id,
  });

const visitRow =
  (homes: number) =>
  (visit: ClientSiteVisit): Row => ({
    id: visit.id,
    startsAt: visit.startsAt,
    title: "Site Visit",
    line: lineOf([
      formatTime(visit.startsAt),
      homes > 1 && addressOf(visit.property),
      `${visit.visitorName}, about ${formatMinutes(visit.minutes)}, free`,
    ]),
  });

// what's not plain about a past clean, the most pressing first
const pastBadge = (job: ClientPastJob) => {
  if (job.unpaid) return <StatusBadge tone="danger">Unpaid</StatusBadge>;
  if (job.awaitingAnswer > 0)
    return <StatusBadge tone="warning">Needs your OK</StatusBadge>;
  if (job.status === "no_access")
    return <StatusBadge tone="danger">No Access</StatusBadge>;
  if (job.status === "cancelled")
    return <StatusBadge>{job.skipped ? "Skipped" : "Cancelled"}</StatusBadge>;
  return undefined;
};

const pastRow =
  (homes: number) =>
  (job: ClientPastJob): Row => ({
    id: job.id,
    startsAt: job.startsAt,
    title: job.serviceName,
    line: lineOf([
      formatTime(job.startsAt),
      homes > 1 && addressOf(job.property),
      job.status === "completed"
        ? formatMoney(job.totalCents)
        : job.feeCents > 0
          ? `${formatMoney(job.feeCents)} fee`
          : "No charge",
    ]),
    badge: pastBadge(job),
    jobId: job.id,
  });

const byMonth = (rows: Row[]) => {
  const months: { month: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const month = monthFormat.format(new Date(row.startsAt));
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

  const upcoming = [
    ...jobs.map(upcomingRow(homes)),
    ...siteVisits.map(visitRow(homes)),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = pastJobs.map(pastRow(homes));
  // Upcoming, unless only Past has anything
  const tab =
    search.tab ??
    (upcoming.length === 0 && past.length > 0 ? "past" : "upcoming");

  const months = (rows: Row[], label: string) =>
    byMonth(rows).map(({ month, rows }) => (
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
      <Heading level={1}>Your cleans</Heading>
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
        <TabList aria-label="Your cleans">
          <Tab id="upcoming" count={upcoming.length}>
            Upcoming
          </Tab>
          <Tab id="past" count={past.length}>
            Past
          </Tab>
        </TabList>
        <TabPanel id="upcoming" className="flex flex-col gap-6">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nothing booked"
              description="Your next clean shows here once it's booked."
            />
          ) : (
            months(upcoming, "Upcoming")
          )}
        </TabPanel>
        <TabPanel id="past" className="flex flex-col gap-6">
          {past.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No cleans yet"
              description="Each clean shows here once it's done, with its receipt."
            />
          ) : (
            <>
              {months(past.slice(0, shown), "Past")}
              {past.length > shown && (
                <Button
                  variant="secondary"
                  className="self-center"
                  onPress={() => setShown(shown + PAGE)}
                >
                  Show more
                </Button>
              )}
            </>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}
