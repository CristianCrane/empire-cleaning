import type { Key, ReactNode } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { QuoteRequestState } from "@empire-cleaning/models";
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
  formatMoney,
  homeSummary,
  quoteHeadline,
  recurrenceLabel,
} from "../format.ts";
import { PlanStatusBadge } from "../PlanParts.tsx";
import { QuoteStatusBadge } from "../QuoteParts.tsx";

const requestBadge: Record<QuoteRequestState, ReactNode> = {
  awaiting_quote: <StatusBadge tone="info">Received</StatusBadge>,
  quoted: <StatusBadge tone="success">Quoted</StatusBadge>,
  booked: <StatusBadge tone="success">Booked</StatusBadge>,
  ended: <StatusBadge>Closed</StatusBadge>,
};

export function PortalHome() {
  const { client, plans, quotes, jobs, pastJobs } = useLoaderData({
    from: "/portal/",
  });
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
                title={`${cleanTypeLabel[plan.cleanType]}, ${recurrenceLabel[plan.recurrence].toLowerCase()}`}
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
          {client.quoteRequests.map((request) => {
            const home = homes.get(request.propertyId);
            return (
              <ListItem
                key={request.id}
                id={request.id}
                title={home ? addressOf(home) : "Your home"}
                description={[
                  `Sent ${formatDate(request.createdAt)}`,
                  `${conditionLabel[request.condition]} clean`,
                  request.addOns.length > 0 &&
                    `Extras: ${request.addOns.map((a) => a.name).join(", ")}`,
                  request.wantsRegularService && "Regular visits wanted",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                end={requestBadge[request.state]}
              />
            );
          })}
        </List>
      </Card>

      <Card title="Your homes">
        <List aria-label="Your homes">
          {client.properties.map((home) => (
            <ListItem
              key={home.id}
              id={home.id}
              title={addressOf(home)}
              description={homeSummary(home)}
            />
          ))}
        </List>
      </Card>
    </div>
  );
}
