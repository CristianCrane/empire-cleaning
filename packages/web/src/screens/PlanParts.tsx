import type { ServicePlanView } from "@empire-cleaning/models";
import { StatusBadge } from "@empire-cleaning/ui";
import { formatDate, formatHours, formatMoney, planRhythm } from "./format.ts";

// a Service Plan's status; On Hold and Ended are #15's
export function PlanStatusBadge({
  status,
}: {
  status: ServicePlanView["status"];
}) {
  switch (status) {
    case "active":
      return <StatusBadge tone="success">Active</StatusBadge>;
    case "on_hold":
      return <StatusBadge tone="warning">On Hold</StatusBadge>;
    default:
      return <StatusBadge>Ended</StatusBadge>;
  }
}

// a Service Plan's terms, as its Client agreed them
export function PlanTerms({
  plan,
}: {
  plan: Omit<ServicePlanView, "upcoming">;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      <dt className="font-semibold">When</dt>
      <dd>{planRhythm(plan)}</dd>
      <dt className="font-semibold">Each clean</dt>
      <dd>
        {formatMoney(plan.totalCents)} including tax, {plan.discountPercent}%
        off a one-off clean
      </dd>
      <dt className="font-semibold">On site</dt>
      <dd>
        About {formatHours(plan.hoursOnSite)}, with a crew of {plan.crewSize}
      </dd>
      <dt className="font-semibold">Extras</dt>
      <dd>{plan.addOns.length > 0 ? plan.addOns.join(", ") : "None"}</dd>
      <dt className="font-semibold">Deposit held</dt>
      <dd>
        {plan.depositCents > 0
          ? `${formatMoney(plan.depositCents)}, which comes off the last clean when the plan ends`
          : "None"}
      </dd>
      <dt className="font-semibold">Started</dt>
      <dd>{formatDate(plan.startedAt)}</dd>
    </dl>
  );
}
