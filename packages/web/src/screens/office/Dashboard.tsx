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
import { AssignmentBadge } from "./JobScreen.tsx";
import {
  addressOf,
  cleanTypeLabel,
  formatDate,
  formatDateTime,
  formatDay,
  formatHours,
  formatMoney,
  formatTime,
} from "../format.ts";

// the Office's first screen: what's waiting on them, then today's Jobs
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
                textValue={`${formatTime(job.startsAt)} ${job.client.name}`}
                title={`${formatTime(job.startsAt)} · ${job.client.name}`}
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
          title: request.client.name,
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
          title: quote.client.name,
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
          title: quote.client.name,
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
          title: job.client.name,
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
          title: job.client.name,
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
          title: job.client.name,
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
          title: job.client.name,
          description: `${item.count === 1 ? "1 extra" : `${item.count} extras`} to review · ${addressOf(job.property)} · ${formatDate(job.startsAt)}`,
          badge: <StatusBadge tone="info">Adjustments</StatusBadge>,
          open: () =>
            navigate({
              to: "/office/jobs/$jobId",
              params: { jobId: job.id },
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
