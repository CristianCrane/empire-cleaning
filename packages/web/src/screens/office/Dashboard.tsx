import type { ReactNode } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { NeedsAttentionItem, TodayJob } from "@empire-cleaning/models";
import {
  Card,
  Heading,
  Link,
  List,
  ListItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { billWeek } from "../BillParts.tsx";
import { AssignmentBadge } from "./JobScreen.tsx";
import { SiteVisitBadge } from "./SiteVisitParts.tsx";
import {
  addressOf,
  cleanTypeLabel,
  clientName,
  formatDate,
  formatDateTime,
  formatDay,
  formatHours,
  formatMinutes,
  formatMoney,
  formatTime,
} from "../format.ts";

// the Office's first screen: what's waiting on them, then today's Jobs and
// Site Visits
export function Dashboard() {
  const { needsAttention, today } = useLoaderData({ from: "/office/" });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <Heading level={1}>Today</Heading>
      <NeedsAttention items={needsAttention} />
      <Card
        title={formatDay(today.date)}
        description={[
          `${formatHours(today.staffHours)} available`,
          `${formatHours(today.bookedHours)} booked`,
        ].join(" · ")}
        actions={
          <Link href={linkTo({ to: "/office/schedule" })}>Schedule</Link>
        }
      >
        {today.jobs.length > 0 ? (
          <List
            aria-label="Today's Jobs"
            onAction={(id) =>
              navigate({
                to: "/office/jobs/$jobId",
                params: { jobId: String(id) },
              })
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
        ) : (
          <p className="text-sm text-fg-muted">No Jobs today.</p>
        )}
        {today.siteVisits.length > 0 && (
          <List
            aria-label="Today's Site Visits"
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
        )}
      </Card>
    </div>
  );
}

// how a Job turned out, or until then whether its Staff are all Confirmed
function JobBadge({ job }: { job: TodayJob }) {
  if (job.outcome === "completed")
    return <StatusBadge tone="success">Completed</StatusBadge>;
  if (job.outcome === "no_access")
    return <StatusBadge tone="danger">No Access</StatusBadge>;
  return <AssignmentBadge job={job} />;
}

type Row = {
  key: string;
  title: string;
  description: string;
  badge: ReactNode;
  open: () => void;
};

function NeedsAttention({ items }: { items: NeedsAttentionItem[] }) {
  const navigate = useNavigate();

  // how each kind of item reads, and where it opens; tickets adding a kind
  // add its case here
  const rowFor = (item: NeedsAttentionItem): Row => {
    switch (item.kind) {
      case "quote_request": {
        const request = item.quoteRequest;
        return {
          key: `quote_request ${request.id}`,
          title: clientName(request.client),
          description: `${addressOf(request.property)} · asked ${formatDate(item.since)}`,
          badge: <StatusBadge tone="info">Quote Request</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/requests/$requestId",
              params: { requestId: request.id },
            }),
        };
      }
      case "quote_expiring": {
        const { quote } = item;
        return {
          key: `quote_expiring ${quote.id}`,
          title: clientName(quote.client),
          description: `${addressOf(quote.property)} · expires ${formatDateTime(quote.expiresAt!)}`,
          badge: <StatusBadge tone="warning">Quote expiring</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/quotes/$quoteId",
              params: { quoteId: quote.id },
            }),
        };
      }
      case "quote_no_room": {
        const { quote } = item;
        return {
          key: `quote_no_room ${quote.id}`,
          title: clientName(quote.client),
          description: `${addressOf(quote.property)} · ${formatDateTime(quote.proposedStartsAt!)} is full`,
          badge: <StatusBadge tone="danger">Needs another time</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/quotes/$quoteId",
              params: { quoteId: quote.id },
            }),
        };
      }
      case "job_unassigned": {
        const { job } = item;
        return {
          key: `job_unassigned ${job.id}`,
          title: clientName(job.client),
          description: `${addressOf(job.property)} · ${formatDateTime(job.startsAt)}`,
          badge: <StatusBadge tone="warning">Unassigned</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };
      }
      case "job_unpaid": {
        const { job } = item;
        return {
          key: `job_unpaid ${job.id}`,
          title: clientName(job.client),
          description: `${formatMoney(item.owedCents)} owed · ${addressOf(job.property)} · ${formatDate(job.startsAt)}`,
          badge: <StatusBadge tone="danger">Unpaid</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };
      }
      case "reschedule_requested": {
        const { job, request } = item;
        return {
          key: `reschedule_requested ${request.id}`,
          title: clientName(job.client),
          description: `${addressOf(job.property)} · ${formatDateTime(request.fromStartsAt)} to ${formatDateTime(request.startsAt)}`,
          badge: <StatusBadge tone="warning">Reschedule Request</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };
      }
      case "adjustments_reported": {
        const { job } = item;
        return {
          key: `adjustments_reported ${job.id}`,
          title: clientName(job.client),
          description: `${item.count === 1 ? "1 extra" : `${item.count} extras`} to review · ${addressOf(job.property)} · ${formatDate(job.startsAt)}`,
          badge: <StatusBadge tone="info">Adjustments</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
            }),
        };
      }
      case "service_plan_due": {
        const { job } = item;
        return {
          key: `service_plan_due ${job.id}`,
          title: clientName(job.client),
          description: `${addressOf(job.property)} · First Clean done ${formatDate(item.since)}, wants regular visits`,
          badge: <StatusBadge tone="info">Offer a Service Plan</StatusBadge>,
          // the home's page, where its history is beside the offer
          open: () =>
            navigate({
              to: "/office/properties/$propertyId",
              params: { propertyId: job.property.id },
            }),
        };
      }
      case "plan_visit_unplaced": {
        const { plan, visit } = item;
        return {
          key: `plan_visit_unplaced ${visit.id}`,
          title: clientName(plan.client),
          description: `${addressOf(plan.property)} · Service Plan visit on ${formatDay(visit.dueOn)}: no room that day`,
          badge: <StatusBadge tone="danger">Needs another time</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/service-plans/$planId",
              params: { planId: plan.id },
            }),
        };
      }
      case "bill_unpaid": {
        const { bill } = item;
        return {
          key: `bill_unpaid ${bill.id}`,
          title: clientName(bill.client),
          description: `Bill ${bill.number} · ${formatMoney(bill.totalCents)} · ${billWeek(bill)}`,
          badge: <StatusBadge tone="danger">Unpaid</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/bills/$billId",
              params: { billId: bill.id },
            }),
        };
      }
      case "plan_on_hold": {
        const { plan } = item;
        const unpaid = [
          item.owedCents > 0 && `${formatMoney(item.owedCents)} Unpaid`,
          item.bills.length > 0 && `Bill ${item.bills.join(" and ")} Unpaid`,
        ]
          .filter(Boolean)
          .join(", ");
        return {
          key: `plan_on_hold ${plan.id}`,
          title: clientName(plan.client),
          description: `${addressOf(plan.property)} · Service Plan: ${unpaid}, no new Jobs booked`,
          badge: <StatusBadge tone="warning">On Hold</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/service-plans/$planId",
              params: { planId: plan.id },
            }),
        };
      }
    }
  };

  return (
    <Card title="Needs attention">
      <List
        aria-label="Needs attention"
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">
            Nothing needs attention right now.
          </p>
        )}
      >
        {items.map(rowFor).map((row) => (
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
    </Card>
  );
}
