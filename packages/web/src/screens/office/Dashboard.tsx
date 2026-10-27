import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { NeedsAttentionItem } from "@empire-cleaning/models";
import {
  CalendarClock,
  CalendarDays,
  CalendarX,
  CircleDollarSign,
  CirclePause,
  ClipboardList,
  Hourglass,
  Inbox,
  Receipt,
  Repeat,
  UserX,
  type LucideIcon,
} from "lucide-react";
import {
  ButtonLink,
  Heading,
  IconTile,
  List,
  ListItem,
  Section,
  type StatusTone,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { billWeek } from "../BillParts.tsx";
import { ScheduleCalendar } from "./ScheduleCalendar.tsx";
import {
  addressOf,
  clientName,
  formatDate,
  formatDateTime,
  formatDay,
  formatHours,
  formatMoney,
} from "../format.ts";

// the Office's first screen: what's waiting on them, then today's Jobs and
// Site Visits on a one-day Schedule
export function Dashboard() {
  const { needsAttention, today } = useLoaderData({ from: "/office/" });

  return (
    <div className="flex flex-col gap-8">
      <Heading level={1}>Today</Heading>
      <NeedsAttention items={needsAttention} />
      <Section
        title="Today's Schedule"
        description={[
          formatDay(today.date),
          `${formatHours(today.staffHours)} available`,
          `${formatHours(today.bookedHours)} booked`,
        ].join(" · ")}
        actions={
          <ButtonLink
            href={linkTo({ to: "/office/schedule" })}
            variant="secondary"
            size="sm"
          >
            <CalendarDays aria-hidden size={16} />
            Week
          </ButtonLink>
        }
      >
        {today.jobs.length > 0 || today.siteVisits.length > 0 ? (
          <ScheduleCalendar days={[today]} opensJobs />
        ) : (
          <p className="text-sm text-fg-muted">No Jobs today.</p>
        )}
      </Section>
    </div>
  );
}

// a row leads with what the Office should do; the icon says what kind of
// item it is, and who it's for comes first in the description
type Row = {
  key: string;
  action: string;
  icon: LucideIcon;
  tone: StatusTone;
  client: string;
  description: string;
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
          action: "Send a Quote",
          icon: Inbox,
          tone: "info",
          client: clientName(request.client),
          description: `${addressOf(request.property)} · asked ${formatDate(item.since)}`,
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
          action: "Follow up before it expires",
          icon: Hourglass,
          tone: "warning",
          client: clientName(quote.client),
          description: `${addressOf(quote.property)} · expires ${formatDateTime(quote.expiresAt!)}`,
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
          action: "Pick another time for the Quote",
          icon: CalendarX,
          tone: "danger",
          client: clientName(quote.client),
          description: `${addressOf(quote.property)} · ${formatDateTime(quote.proposedStartsAt!)} is full`,
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
          action: "Assign Staff",
          icon: UserX,
          tone: "warning",
          client: clientName(job.client),
          description: `${addressOf(job.property)} · ${formatDateTime(job.startsAt)}`,
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
          action: "Collect the Balance",
          icon: CircleDollarSign,
          tone: "danger",
          client: clientName(job.client),
          description: `${formatMoney(item.owedCents)} owed · ${addressOf(job.property)} · ${formatDate(job.startsAt)}`,
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
          action: "Confirm or turn down the new time",
          icon: CalendarClock,
          tone: "warning",
          client: clientName(job.client),
          description: `${addressOf(job.property)} · ${formatDateTime(request.fromStartsAt)} to ${formatDateTime(request.startsAt)}`,
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
          action: "Review extras Staff reported",
          icon: ClipboardList,
          tone: "info",
          client: clientName(job.client),
          description: `${item.count === 1 ? "1 extra" : `${item.count} extras`} to review · ${addressOf(job.property)} · ${formatDate(job.startsAt)}`,
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
          action: "Offer a Service Plan",
          icon: Repeat,
          tone: "info",
          client: clientName(job.client),
          description: `${addressOf(job.property)} · First Clean done ${formatDate(item.since)}, wants regular visits`,
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
          action: "Book the visit or skip it",
          icon: CalendarX,
          tone: "danger",
          client: clientName(plan.client),
          description: `${addressOf(plan.property)} · Service Plan visit on ${formatDay(visit.dueOn)}: no room that day`,
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
          action: "Collect the Bill",
          icon: Receipt,
          tone: "danger",
          client: clientName(bill.client),
          description: `Bill ${bill.number} · ${formatMoney(bill.totalCents)} · ${billWeek(bill)}`,
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
          action: "Collect what's owed to resume the plan",
          icon: CirclePause,
          tone: "warning",
          client: clientName(plan.client),
          description: `${addressOf(plan.property)} · Service Plan: ${unpaid}, no new Jobs booked`,
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
    <Section title="Needs attention">
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
            textValue={`${row.action} ${row.client}`}
            title={row.action}
            description={
              <>
                <span className="font-semibold text-fg">{row.client}</span>
                {" · "}
                {row.description}
              </>
            }
            start={<IconTile icon={row.icon} tone={row.tone} />}
            onAction={row.open}
          />
        ))}
      </List>
    </Section>
  );
}
