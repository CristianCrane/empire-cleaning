import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { BrushCleaning } from "lucide-react";
import type {
  ClientPastJob,
  ClientSiteVisit,
  ClientUpcomingJob,
} from "@empire-cleaning/models";
import { catalog } from "@empire-cleaning/models";
import { ListPage, type ListRow } from "@empire-cleaning/ui";
import { addressOf, formatMinutes, howLong, lineOf } from "../format.ts";
import { tabShown, useListUrl } from "../list-search.ts";
import { type Said, useSaid } from "../words.ts";
import { cleanBadge, upcomingBadge } from "./clean-badge.tsx";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    visit: (visitor: string, length: string) =>
      `${visitor}, about ${length}, free`,
    fee: (amount: string) => `${amount} fee`,
    noCharge: "No charge",
    upcoming: "Upcoming",
    past: "Past",
    noneYet: "No cleans yet",
  },
  es: {
    visit: (visitor: string, length: string) =>
      `${visitor}, cerca de ${length}, gratis`,
    fee: (amount: string) => `cargo de ${amount}`,
    noCharge: "Sin cargo",
    upcoming: "Próximas",
    past: "Pasadas",
    noneYet: "Aún no hay limpiezas",
  },
});
type T = Said & { w: (typeof words)["en"] };

// The Client's cleans (#96, #433), a List: Upcoming (with their Site
// Visits) and Past, each by month, the kind of clean leading each row
// after its time. Only what isn't plain gets a badge (cleanBadge): a
// clean booked or done needs none.

export const cleansTabs = ["upcoming", "past"] as const;
type CleansTab = (typeof cleansTabs)[number];

const upcomingRow =
  (t: T, homes: number, open: (jobId: string) => void) =>
  (job: ClientUpcomingJob): ListRow => ({
    id: job.id,
    at: job.startsAt,
    title: job.serviceName,
    description: lineOf([
      homes > 1 && addressOf(job.property),
      howLong(t, job.hoursOnSite),
    ]),
    badges: [upcomingBadge(t, job)],
    onOpen: () => open(job.id),
  });

const visitRow =
  (t: T, homes: number) =>
  (visit: ClientSiteVisit): ListRow => ({
    id: visit.id,
    at: visit.startsAt,
    title: t.siteVisit,
    description: lineOf([
      homes > 1 && addressOf(visit.property),
      t.w.visit(visit.visitorName, formatMinutes(visit.minutes)),
    ]),
  });

const pastRow =
  (t: T, homes: number, open: (jobId: string) => void) =>
  (job: ClientPastJob): ListRow => ({
    id: job.id,
    at: job.startsAt,
    title: job.serviceName,
    description: lineOf([
      homes > 1 && addressOf(job.property),
      job.status === "completed"
        ? t.formatMoney(job.totalCents)
        : job.feeCents > 0
          ? t.w.fee(t.formatMoney(job.feeCents))
          : t.w.noCharge,
    ]),
    badges: [
      cleanBadge(t, {
        status: job.status,
        unpaid: job.unpaid,
        priceChange: job.waiting.length > 0,
        skipped: job.skipped,
        moveAsked: false,
      }),
    ],
    onOpen: () => open(job.id),
  });

export function PortalCleans() {
  const { client, jobs, pastJobs, siteVisits } = useLoaderData({
    from: "/portal/cleans",
  });
  const url = useListUrl<CleansTab>();
  const navigate = useNavigate();
  const homes = client.properties.length;
  const t = useSaid(words);
  const { w } = t;
  const open = (jobId: string) =>
    void navigate({ to: "/portal/jobs/$jobId", params: { jobId } });

  const upcoming = [
    ...jobs.map(upcomingRow(t, homes, open)),
    ...siteVisits.map(visitRow(t, homes)),
  ].sort((a, b) => a.at!.localeCompare(b.at!));
  const past = pastJobs.map(pastRow(t, homes, open));
  // Upcoming, unless only Past has anything
  const tab = tabShown(cleansTabs, url.tab, (t) =>
    t === "upcoming" ? upcoming.length : past.length,
  );

  return (
    <ListPage<ListRow>
      title={t.p.cleans}
      tabs={[
        {
          id: "upcoming",
          label: w.upcoming,
          count: upcoming.length,
          none: t.p.nothingBooked,
        },
        { id: "past", label: w.past, count: past.length, none: w.noneYet },
      ]}
      tab={tab}
      onTabChange={url.onTabChange}
      items={tab === "upcoming" ? upcoming : past}
      row={(row) => row}
      empty={{ icon: BrushCleaning, title: w.noneYet }}
    />
  );
}
