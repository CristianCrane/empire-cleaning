import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { BrushCleaning } from "lucide-react";
import type {
  ClientPastJob,
  ClientSiteVisit,
  ClientUpcomingJob,
} from "@empire-cleaning/models";
import { catalog } from "@empire-cleaning/models";
import { ListPage, StatusBadge, type ListRow } from "@empire-cleaning/ui";
import { addressOf, formatHours, formatMinutes } from "../format.ts";
import { tabShown, useListUrl } from "../list-search.ts";
import { JobStatusBadge } from "../JobBadges.tsx";
import { type Said, useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    about: (length: string) => `about ${length}`,
    moveAsked: "Move asked",
    visit: (visitor: string, length: string) =>
      `${visitor}, about ${length}, free`,
    needsOk: "Needs your OK",
    fee: (amount: string) => `${amount} fee`,
    noCharge: "No charge",
    upcoming: "Upcoming",
    past: "Past",
    noneYet: "No cleans yet",
  },
  es: {
    about: (length: string) => `cerca de ${length}`,
    moveAsked: "Reprogramación pedida",
    visit: (visitor: string, length: string) =>
      `${visitor}, cerca de ${length}, gratis`,
    needsOk: "Necesita su aprobación",
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
// after its time. Only what isn't plain gets a badge: a clean booked or
// done needs none.

export const cleansTabs = ["upcoming", "past"] as const;
type CleansTab = (typeof cleansTabs)[number];

// "12 Elm St · $184.50": the home only when there's more than one
const lineOf = (parts: (string | false)[]) => parts.filter(Boolean).join(" · ");

const upcomingRow =
  (t: T, homes: number, open: (jobId: string) => void) =>
  (job: ClientUpcomingJob): ListRow => ({
    id: job.id,
    at: job.startsAt,
    title: job.serviceName,
    description: lineOf([
      homes > 1 && addressOf(job.property),
      t.w.about(formatHours(job.hoursOnSite)),
    ]),
    badges: [
      job.movingTo && (
        <StatusBadge key="move" tone="info">
          {t.w.moveAsked}
        </StatusBadge>
      ),
    ],
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

// what's not plain about a past clean, the most pressing first
const pastBadge = (t: T, job: ClientPastJob) => {
  if (job.unpaid) return <StatusBadge tone="danger">{t.unpaid}</StatusBadge>;
  if (job.awaitingAnswer > 0)
    return <StatusBadge tone="warning">{t.w.needsOk}</StatusBadge>;
  if (job.status === "no_access") return <JobStatusBadge status="no_access" />;
  if (job.status === "cancelled")
    return <StatusBadge>{t.cancelledLabel(job.skipped)}</StatusBadge>;
  return undefined;
};

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
    badges: [pastBadge(t, job)],
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
      title={t.p.yourCleans}
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
