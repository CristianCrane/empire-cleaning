import type { Key } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  Breadcrumbs,
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
  formatDateTime,
  formatHours,
} from "../format.ts";
import { EndPlan, OnHold, PlanStatusBadge, PlanTerms } from "../PlanParts.tsx";

// one of the Client's Service Plans: its terms, what each clean costs, the
// Deposit held for it, and its cleans on the Schedule; why it's On Hold, if
// it is; and Ending it
export function PortalPlan() {
  const plan = useLoaderData({ from: "/portal/plans/$planId" });
  const navigate = useNavigate();
  const openJob = (id: Key) =>
    navigate({ to: "/portal/jobs/$jobId", params: { jobId: String(id) } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Home", href: linkTo({ to: "/portal" }) },
            { label: "Your Service Plan" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>Your Service Plan</Heading>
          <PlanStatusBadge status={plan.status} />
        </div>
        <p className="text-fg-muted">{addressOf(plan.property)}</p>
      </div>

      <OnHold
        plan={plan}
        forClient
        jobHref={(jobId) =>
          linkTo({ to: "/portal/jobs/$jobId", params: { jobId } })
        }
      />

      <Card title={cleanTypeLabel[plan.cleanType]}>
        <PlanTerms plan={plan} />
        <p className="text-sm text-fg-muted">
          Each clean is charged to your saved card when it's done. We email a
          reminder the day before.
        </p>
      </Card>

      <Card
        title="Your upcoming cleans"
        description="Each clean goes on the Schedule about 4 weeks ahead."
      >
        <List
          aria-label="Your upcoming cleans"
          onAction={openJob}
          renderEmptyState={() => (
            <p className="p-6 text-center text-fg-muted">
              {plan.status === "ended"
                ? "No cleans booked."
                : "No cleans booked just now. We'll be in touch about your next one."}
            </p>
          )}
        >
          {plan.upcoming.map((job) => (
            <ListItem
              key={job.id}
              id={job.id}
              title={formatDateTime(job.startsAt)}
              description={`About ${formatHours(job.hoursOnSite)} on site`}
              end={<StatusBadge tone="success">Booked</StatusBadge>}
            />
          ))}
        </List>
      </Card>

      <EndPlan
        plan={plan}
        forClient
        endPath={`/api/service-plans/mine/${plan.id}/end`}
      />
    </div>
  );
}
