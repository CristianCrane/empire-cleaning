import type { Key, ReactNode } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { PropertyView, QuoteStatus } from "@empire-cleaning/models";
import {
  ButtonLink,
  Card,
  Heading,
  List,
  ListItem,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  cleanTypeLabel,
  conditionLabel,
  formatDate,
  formatDateTime,
  formatHours,
  formatMinutes,
  formatMoney,
  propertySummary,
  wantedCleaning,
  quoteHeadline,
  planName,
} from "../format.ts";
import { BillStatusBadge, billLine } from "../BillParts.tsx";
import { PlanStatusBadge } from "../PlanParts.tsx";
import { QuoteStatusBadge } from "../QuoteParts.tsx";

// where what a Client asked for stands (#102 reshapes this)
const requestBadge: Record<QuoteStatus, ReactNode> = {
  requested: <StatusBadge tone="info">Received</StatusBadge>,
  draft: <StatusBadge tone="info">Received</StatusBadge>,
  sent: <StatusBadge tone="success">Quoted</StatusBadge>,
  accepted: <StatusBadge tone="success">Booked</StatusBadge>,
  declined: <StatusBadge>Closed</StatusBadge>,
  expired: <StatusBadge>Closed</StatusBadge>,
  turned_down: <StatusBadge>Closed</StatusBadge>,
};

// "Your homes", "Your premises", or both
const placesTitle = (places: PropertyView[]) => {
  const commercial = places.filter((p) => p.kind === "commercial").length;
  if (commercial === 0) return "Your homes";
  return commercial === places.length
    ? "Your premises"
    : "Your homes and premises";
};

export function PortalHome() {
  const { client, plans, jobs, pastJobs, siteVisits, bills, ...loaded } =
    useLoaderData({ from: "/portal/" });
  // the offers: what was asked, with nothing Sent yet, is listed below
  const quotes = loaded.quotes.filter((q) => q.sentAt !== null);
  const navigate = useNavigate();
  const [firstName] = client.name.split(" ");
  const homes = new Map(client.properties.map((p) => [p.id, p]));
  const openJob = (id: Key) =>
    navigate({ to: "/portal/jobs/$jobId", params: { jobId: String(id) } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading level={1}>Welcome, {firstName}</Heading>
        <ButtonLink href={linkTo({ to: "/portal/request" })}>
          Request a Quote
        </ButtonLink>
      </div>

      {bills.length > 0 && (
        <Card
          title="Your Bills"
          description="Each week's cleans on one Bill, made the following Monday."
        >
          <List
            aria-label="Your Bills"
            onAction={(id) =>
              navigate({
                to: "/portal/bills/$billId",
                params: { billId: String(id) },
              })
            }
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
        </Card>
      )}

      {plans.length > 0 && (
        <Card
          title={
            plans.length === 1 ? "Your Service Plan" : "Your Service Plans"
          }
        >
          <List
            aria-label="Your Service Plans"
            onAction={(id) =>
              navigate({
                to: "/portal/plans/$planId",
                params: { planId: String(id) },
              })
            }
          >
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
        </Card>
      )}

      {siteVisits.length > 0 && (
        <Card
          title={
            siteVisits.length === 1 ? "Your Site Visit" : "Your Site Visits"
          }
          description="Free: we come to see it before we quote. To change the time, please call us."
        >
          <List aria-label="Your Site Visits">
            {siteVisits.map((visit) => (
              <ListItem
                key={visit.id}
                id={visit.id}
                title={formatDateTime(visit.startsAt)}
                description={[
                  addressOf(visit.property),
                  `${visit.visitorName} visits for about ${formatMinutes(visit.minutes)}`,
                ].join(" · ")}
                end={<StatusBadge tone="info">Booked</StatusBadge>}
              />
            ))}
          </List>
        </Card>
      )}

      {jobs.length > 0 && (
        <Card
          title="Your upcoming Jobs"
          description="We email a reminder the day before each one."
        >
          <List aria-label="Your upcoming Jobs" onAction={openJob}>
            {jobs.map((job) => (
              <ListItem
                key={job.id}
                id={job.id}
                title={formatDateTime(job.startsAt)}
                description={[
                  cleanTypeLabel[job.cleanType],
                  addressOf(job.property),
                  `About ${formatHours(job.hoursOnSite)} on site`,
                ].join(" · ")}
                end={<StatusBadge tone="success">Booked</StatusBadge>}
              />
            ))}
          </List>
        </Card>
      )}

      {pastJobs.length > 0 && (
        <Card title="Your past Jobs" description="Each with its receipt.">
          <List aria-label="Your past Jobs" onAction={openJob}>
            {pastJobs.map((job) => (
              <ListItem
                key={job.id}
                id={job.id}
                title={formatDateTime(job.startsAt)}
                description={[
                  cleanTypeLabel[job.cleanType],
                  addressOf(job.property),
                  formatMoney(job.totalCents),
                ].join(" · ")}
                end={
                  job.unpaid ? (
                    <StatusBadge tone="danger">Unpaid</StatusBadge>
                  ) : job.awaitingAnswer > 0 ? (
                    <StatusBadge tone="warning">Needs your answer</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Done</StatusBadge>
                  )
                }
              />
            ))}
          </List>
        </Card>
      )}

      {quotes.length > 0 && (
        <Card title="Your Quotes">
          <List
            aria-label="Your Quotes"
            onAction={(id) =>
              navigate({
                to: "/portal/quotes/$quoteId",
                params: { quoteId: String(id) },
              })
            }
          >
            {quotes.map((quote) => (
              <ListItem
                key={quote.id}
                id={quote.id}
                title={addressOf(quote.property)}
                description={[
                  `${quote.plan ? "Starting" : "For"} ${formatDateTime(quote.proposedStartsAt!)}`,
                  quoteHeadline(quote),
                ].join(" · ")}
                end={<QuoteStatusBadge status={quote.status} />}
              />
            ))}
          </List>
        </Card>
      )}

      <Card
        title="Your Quote Requests"
        description="We email your Quote, usually within a working day."
      >
        <List
          aria-label="Your Quote Requests"
          renderEmptyState={() => (
            <p className="p-6 text-center text-fg-muted">
              No Quote Requests yet.
            </p>
          )}
        >
          {client.quotes.flatMap((quote) => {
            const { asked } = quote;
            if (!asked) return [];
            const home = homes.get(quote.property.id);
            return [
              <ListItem
                key={quote.id}
                id={quote.id}
                title={home ? addressOf(home) : "Your home"}
                description={[
                  `Sent ${formatDate(quote.createdAt)}`,
                  asked.condition
                    ? `${conditionLabel[asked.condition]} clean`
                    : wantedCleaning(asked),
                  asked.addOns.length > 0 &&
                    `Extras: ${asked.addOns.map((a) => a.name).join(", ")}`,
                  asked.wantsRegularService &&
                    asked.condition &&
                    "Regular visits wanted",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                end={
                  quote.siteVisit === "booked" ? (
                    <StatusBadge tone="info">Site Visit booked</StatusBadge>
                  ) : (
                    requestBadge[quote.status]
                  )
                }
              />,
            ];
          })}
        </List>
      </Card>

      <Card title={placesTitle(client.properties)}>
        <List aria-label={placesTitle(client.properties)}>
          {client.properties.map((home) => (
            <ListItem
              key={home.id}
              id={home.id}
              title={addressOf(home)}
              description={propertySummary(home)}
            />
          ))}
        </List>
      </Card>
    </div>
  );
}
