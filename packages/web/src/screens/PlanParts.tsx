import type { ReactNode } from "react";
import {
  CalendarClock,
  CircleStop,
  CirclePlus,
  Clock,
  PiggyBank,
  Receipt,
  Users,
} from "lucide-react";
import type { EndPlanTerms, ServicePlanView } from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Button,
  ButtonLink,
  Card,
  Dialog,
  DialogTrigger,
  IconTile,
  Notice,
  Section,
  StatusBadge,
} from "@empire-cleaning/ui";
import { postJson } from "../api.ts";
import type { AppHref } from "../links.ts";
import { useAction } from "./action.ts";
import {
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
  planDayWhen,
  recurrenceLabel,
} from "./format.ts";
import { Fact } from "./Fact.tsx";

// a Service Plan's status
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
      // stopped for good: red
      return <StatusBadge tone="danger">Ended</StatusBadge>;
  }
}

// Who's looking: the Client, in the portal, or Office Staff, acting for
// them. The words follow; so do where the plan's Jobs open and where Ending
// it posts.
type Viewer = {
  forClient: boolean;
  jobHref: (jobId: string) => AppHref;
  endPath: string;
};

// why a plan is On Hold, and the way to its Unpaid Jobs and Bills
export function OnHold({
  plan,
  forClient,
  jobHref,
  billHref,
}: {
  plan: Omit<ServicePlanView, "upcoming">;
  billHref: (billId: string) => AppHref;
} & Omit<Viewer, "endPath">) {
  if (plan.status !== "on_hold") return null;
  const unpaid = [
    ...plan.unpaid.map(
      (u) =>
        `the clean on ${formatDateTime(u.startsAt)} (${formatMoney(u.owedCents)})`,
    ),
    ...plan.unpaidBills.map(
      (b) => `bill ${b.number} (${formatMoney(b.totalCents)})`,
    ),
  ];
  return (
    <Section title="On Hold">
      <Card>
        <p>
          {forClient
            ? "We couldn't take payment for "
            : "The Client's payment couldn't be taken for "}
          {unpaid.join(" and ")}.{" "}
          {forClient
            ? "Cleans already booked go ahead, but we won't book any more until it's paid."
            : "Jobs already booked go ahead, but no more are booked until it's paid."}
        </p>
        <Actions>
          {plan.unpaid.map((u) => (
            <ButtonLink key={u.jobId} href={jobHref(u.jobId)}>
              {forClient ? "Pay for " : "See "}
              {plan.unpaid.length > 1
                ? `the ${formatDate(u.startsAt)} clean`
                : forClient
                  ? "that clean"
                  : "the Job"}
            </ButtonLink>
          ))}
          {plan.unpaidBills.map((b) => (
            <ButtonLink key={b.billId} href={billHref(b.billId)}>
              {forClient ? "Pay" : "See"} bill {b.number}
            </ButtonLink>
          ))}
        </Actions>
      </Card>
    </Section>
  );
}

// what Ending a plan does, as sentences
function endingLines(terms: EndPlanTerms, forClient: boolean) {
  const your = forClient ? "your" : "the Client's";
  const final = formatDateTime(terms.finalJob.startsAt);
  const deposit = formatMoney(terms.depositCents);
  return [
    terms.cancelled.length > 0 &&
      `It cancels ${your} ${terms.cancelled.length === 1 ? "clean" : `${terms.cancelled.length} cleans`} booked more than 24 hours away, free: ${terms.cancelled.map(formatDateTime).join("; ")}.`,
    terms.goingAhead.length > 0 &&
      `${forClient ? "Your" : "The"} clean on ${terms.goingAhead.map(formatDateTime).join("; ")} is less than 24 hours away, so it goes ahead.`,
    terms.depositCents > 0 &&
      (terms.deposit === "comes_off"
        ? `${forClient ? "Your" : "The"} ${deposit} Deposit comes off the price of the clean on ${final}.`
        : terms.deposit === "refunded"
          ? `${forClient ? "Your" : "The"} ${deposit} Deposit is refunded.`
          : `${forClient ? "Your" : "The"} ${deposit} Deposit goes towards the clean on ${final}, and whatever isn't owed is refunded.`),
    forClient
      ? "We won't book any more cleans. You're welcome to start a new plan later."
      : "No more Jobs are booked. The home can start a new plan later.",
  ].filter((line): line is string => typeof line === "string");
}

// Ending a plan, at any time: the button, and what it does now in the
// dialog that confirms it
export function EndPlan({
  plan,
  forClient,
  endPath,
}: { plan: Omit<ServicePlanView, "upcoming"> } & Omit<Viewer, "jobHref">) {
  // what Ending does may have changed since the page loaded
  const action = useAction("The plan wasn't Ended. Please try again.", {
    reloadOnFailure: true,
  });
  if (plan.status === "ended") {
    return (
      <Section title="Ended">
        <Card>
          <p>
            {forClient ? "Your" : "This"} Service Plan Ended on{" "}
            {formatDate(plan.endedAt!)}. No more cleans are booked for it.
          </p>
        </Card>
      </Section>
    );
  }
  const terms = plan.endTerms!;
  const lines = endingLines(terms, forClient);

  const end = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(endPath, { goingAhead: terms.goingAhead }),
      forClient ? "Your Service Plan has Ended" : "Service Plan Ended",
    );
    if (ok) close();
  };

  return (
    <Section title={forClient ? "Ending your plan" : "Ending the plan"}>
      <Card>
        <ActionRow
          actions={
            <DialogTrigger>
              <Button variant="danger">
                <CircleStop aria-hidden size={18} />
                End plan
              </Button>
              <Dialog
                title={
                  forClient
                    ? "End your Service Plan?"
                    : "End this Service Plan?"
                }
                role="alertdialog"
              >
                {({ close }) => (
                  <>
                    {lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    <p>
                      <strong>An Ended plan can't be started again.</strong>
                    </p>
                    {action.problem && (
                      <Notice tone="danger">{action.problem}</Notice>
                    )}
                    <Actions>
                      <Button variant="quiet" onPress={close}>
                        {forClient ? "Keep my plan" : "Keep the plan"}
                      </Button>
                      <Button
                        variant="danger"
                        isPending={action.isPending}
                        onPress={() => void end(close)}
                      >
                        End plan
                      </Button>
                    </Actions>
                  </>
                )}
              </Dialog>
            </DialogTrigger>
          }
        >
          <p>
            {forClient ? "End your plan" : "End it for the Client"} at any time:
            you'll see what it cancels first.
          </p>
        </ActionRow>
      </Card>
    </Section>
  );
}

// The plan as its Client and the Office read it: when, large, every weekday of it (one
// answer to "when is my clean?"), then its facts in even columns across, each
// an icon, a value and what the value is. Three text styles, no more.
// (UX pass, #96)
export function PlanFacts({
  plan,
  forClient,
  badge,
}: {
  plan: Omit<ServicePlanView, "upcoming">;
  forClient: boolean;
  // its status, beside how often, where the page doesn't say it already
  badge?: ReactNode;
}) {
  const [one] = plan.days;
  const several = plan.days.length > 1;
  const ended = plan.status === "ended";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <IconTile icon={CalendarClock} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-fg-muted">
              {recurrenceLabel[plan.recurrence]}
            </p>
            {badge}
          </div>
          {plan.days.map((day) => (
            <p key={day.startsAt} className="text-xl font-semibold text-fg">
              {planDayWhen(day.startsAt)}
              {several && (
                <span className="font-normal text-fg-muted">
                  {" "}
                  · {day.serviceName}
                </span>
              )}
            </p>
          ))}
          {!several && <p className="text-fg-muted">{one!.serviceName}</p>}
        </div>
      </div>
      {/* the columns follow the card's width, not the screen's: on the
          Office's page for a home it shares the screen with the History */}
      <div className="@container">
        <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
          <Fact
            icon={Receipt}
            label={several ? "Each week" : "Each clean"}
            value={formatMoney(
              several ? plan.roundTotalCents : one!.totalCents,
            )}
            line={`${several ? "Each week" : "Each clean"}, tax included, ${plan.discountPercent}% off`}
          />
          {several ? (
            <Fact
              icon={Users}
              label="On site"
              value={plan.days
                .map((d) => formatHours(d.hoursOnSite))
                .join(" + ")}
              line="On site, each day"
            />
          ) : (
            <Fact
              icon={Clock}
              label="On site"
              value={`About ${formatHours(one!.hoursOnSite)}`}
              line={`On site, ${one!.crewSize === 1 ? "1 cleaner" : `${one!.crewSize} cleaners`}`}
            />
          )}
          <Fact
            icon={CirclePlus}
            label="Extras"
            value={plan.addOns.length > 0 ? plan.addOns.join(", ") : "None"}
          />
          <Fact
            icon={PiggyBank}
            label="Deposit"
            value={
              plan.depositCents === 0 ? "None" : formatMoney(plan.depositCents)
            }
            line={
              plan.depositCents === 0
                ? "Deposit"
                : ended
                  ? "Deposit, put towards the last clean"
                  : `Deposit, comes off ${forClient ? "your" : "the"} last clean`
            }
          />
        </dl>
      </div>
      <p className="text-sm text-fg-muted">
        Started {formatDate(plan.startedAt)}
        {plan.endedAt && ` · Ended ${formatDate(plan.endedAt)}`}
      </p>
    </div>
  );
}
