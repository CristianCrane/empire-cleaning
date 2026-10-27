// PROTOTYPE: throwaway. Four ways to contain the Today screen's sections, on
// /office?variant=A|B|C|D. Question: which sections need a Card, and how do
// lists sit inside them without reading as two boxes?
//   A  Current: Card around a bordered List (box in a box)
//   B  Sections: no Cards; a plain header over a bordered List (one box)
//   C  Flush card: the Card stays, the List fills it edge to edge (one box)
//   D  Open: no boxes; header and hairline rows on the page (zero boxes)
import type { ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { NeedsAttentionItem, Today } from "@empire-cleaning/models";
import { Heading, Link, List, ListItem } from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { PrototypeSwitcher } from "../PrototypeSwitcher.tsx";
import { JobBadge, useAttentionRows, type Row } from "./Dashboard.tsx";
import { SiteVisitBadge } from "./SiteVisitParts.tsx";
import {
  addressOf,
  cleanTypeLabel,
  clientName,
  formatDay,
  formatHours,
  formatMinutes,
  formatTime,
} from "../format.ts";

const variants = [
  { key: "A", name: "Current" },
  { key: "B", name: "Sections, boxed lists" },
  { key: "C", name: "Flush card" },
  { key: "D", name: "Open rows" },
];

type Props = {
  needsAttention: NeedsAttentionItem[];
  today: Today;
  current: ReactNode;
};

export function TodayCardsPrototype({ needsAttention, today, current }: Props) {
  const { variant = "A" } = useSearch({ from: "/office/" });
  const navigate = useNavigate({ from: "/office/" });
  const rows = useAttentionRows(needsAttention);

  return (
    <>
      {variant === "A" && current}
      {variant === "B" && <VariantB rows={rows} today={today} />}
      {variant === "C" && <VariantC rows={rows} today={today} />}
      {variant === "D" && <VariantD rows={rows} today={today} />}
      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onChange={(key) =>
          navigate({ search: { variant: key }, replace: true })
        }
      />
    </>
  );
}

type VariantProps = { rows: Row[]; today: Today };

// the day's meta line and its link, the same in every variant
const todayDescription = (today: Today) =>
  [
    `${formatHours(today.staffHours)} available`,
    `${formatHours(today.bookedHours)} booked`,
  ].join(" · ");
const scheduleLink = (
  <Link href={linkTo({ to: "/office/schedule" })}>Schedule</Link>
);

// B: sections sit on the page; only the List draws a box
function VariantB({ rows, today }: VariantProps) {
  return (
    <div className="flex flex-col gap-8">
      <Heading level={1}>Today</Heading>
      <section className="flex flex-col gap-3">
        <Heading level={2} size={3}>
          Needs attention
        </Heading>
        <AttentionList rows={rows} />
      </section>
      <section className="flex flex-col gap-3">
        <header className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <Heading level={2} size={3}>
              {formatDay(today.date)}
            </Heading>
            <p className="text-sm text-fg-muted">{todayDescription(today)}</p>
          </div>
          {scheduleLink}
        </header>
        <JobsList today={today} />
        <SiteVisitsList today={today} />
      </section>
    </div>
  );
}

// C: the Card is the only box; its List runs to the Card's edges and the
// header carries the padding
function VariantC({ rows, today }: VariantProps) {
  const flush = "rounded-none border-0 border-t";
  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Today</Heading>
      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-raised">
        <header className="px-4 py-3 sm:px-5">
          <Heading level={2} size={3}>
            Needs attention
          </Heading>
        </header>
        <AttentionList rows={rows} className={flush} />
      </section>
      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-raised">
        <header className="flex items-start gap-3 px-4 py-3 sm:px-5">
          <div className="flex flex-1 flex-col gap-1">
            <Heading level={2} size={3}>
              {formatDay(today.date)}
            </Heading>
            <p className="text-sm text-fg-muted">{todayDescription(today)}</p>
          </div>
          {scheduleLink}
        </header>
        <JobsList today={today} className={flush} />
        <SiteVisitsList today={today} className={flush} />
      </section>
    </div>
  );
}

// D: no boxes at all; a rule under each header and hairlines between rows
function VariantD({ rows, today }: VariantProps) {
  const open = "rounded-none border-0 border-b bg-transparent";
  return (
    <div className="flex flex-col gap-10">
      <Heading level={1}>Today</Heading>
      <section className="flex flex-col">
        <header className="border-b border-border-strong pb-2">
          <Heading level={2} size={3}>
            Needs attention
          </Heading>
        </header>
        <AttentionList rows={rows} className={open} />
      </section>
      <section className="flex flex-col">
        <header className="flex items-end gap-3 border-b border-border-strong pb-2">
          <div className="flex flex-1 flex-col gap-1">
            <Heading level={2} size={3}>
              {formatDay(today.date)}
            </Heading>
            <p className="text-sm text-fg-muted">{todayDescription(today)}</p>
          </div>
          {scheduleLink}
        </header>
        <JobsList today={today} className={open} />
        <SiteVisitsList today={today} className={open} />
      </section>
    </div>
  );
}

function AttentionList({
  rows,
  className,
}: {
  rows: Row[];
  className?: string;
}) {
  return (
    <List
      aria-label="Needs attention"
      className={className}
      renderEmptyState={() => (
        <p className="p-6 text-center text-fg-muted">
          Nothing needs attention right now.
        </p>
      )}
    >
      {rows.map((row) => (
        <ListItem
          key={row.key}
          id={row.key}
          title={row.title}
          description={row.description}
          end={row.badge}
          onAction={row.open}
        />
      ))}
    </List>
  );
}

function JobsList({ today, className }: { today: Today; className?: string }) {
  const navigate = useNavigate();
  if (today.jobs.length === 0)
    return <p className="px-4 py-3 text-sm text-fg-muted">No Jobs today.</p>;
  return (
    <List
      aria-label="Today's Jobs"
      className={className}
      onAction={(id) =>
        navigate({ to: "/office/jobs/$jobId", params: { jobId: String(id) } })
      }
    >
      {today.jobs.map((job) => (
        <ListItem
          key={job.id}
          id={job.id}
          textValue={`${formatTime(job.startsAt)} ${clientName(job.client)}`}
          title={`${formatTime(job.startsAt)} · ${clientName(job.client)}`}
          description={[
            addressOf(job.property),
            cleanTypeLabel[job.cleanType],
            `crew of ${job.crewSize}, ${formatHours(job.hoursOnSite)} on site`,
          ].join(" · ")}
          end={<JobBadge job={job} />}
        />
      ))}
    </List>
  );
}

function SiteVisitsList({
  today,
  className,
}: {
  today: Today;
  className?: string;
}) {
  const navigate = useNavigate();
  if (today.siteVisits.length === 0) return null;
  return (
    <List
      aria-label="Today's Site Visits"
      className={className}
      onAction={(id) =>
        navigate({
          to: "/office/site-visits/$visitId",
          params: { visitId: String(id) },
        })
      }
    >
      {today.siteVisits.map((visit) => (
        <ListItem
          key={visit.id}
          id={visit.id}
          textValue={`${formatTime(visit.startsAt)} Site Visit ${clientName(visit.client)}`}
          title={`${formatTime(visit.startsAt)} · Site Visit · ${clientName(visit.client)}`}
          description={[
            addressOf(visit.property),
            visit.visitor?.name,
            formatMinutes(visit.minutes),
          ].join(" · ")}
          end={<SiteVisitBadge status={visit.status} />}
        />
      ))}
    </List>
  );
}
