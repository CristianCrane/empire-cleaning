import type { Key } from "react";
import {
  CalendarClock,
  CirclePlus,
  Clock,
  PiggyBank,
  Receipt,
  Users,
} from "lucide-react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { ClientView, ServicePlanView } from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  IconTile,
  List,
  ListItem,
  Notice,
  Section,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { getJson, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  addressOf,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
  planDayWhen,
  recurrenceLabel,
} from "../format.ts";
import { EndPlan, OnHold, PlanStatusBadge } from "../PlanParts.tsx";
import { Fact } from "./Fact.tsx";

// how the Client pays for their cleans: each when it's done, or on a weekly
// Bill (ADR-0016), charged or paid on its page
const paymentLine = {
  per_clean: "Each clean is charged to your saved card when it's done.",
  automatic:
    "Each week's cleans go on one Bill, made the following Monday and charged to your saved Payment Method.",
  on_page:
    "Each week's cleans go on one Bill, made the following Monday, which you pay on its page by its due date.",
};

// one of the Client's Service Plans: its terms, what each clean costs, the
// Deposit held for it, and its cleans on the Schedule; why it's On Hold, if
// it is; asking for different terms; and Ending it
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
            { label: "Your details", href: linkTo({ to: "/portal/details" }) },
            {
              label: plan.property.street,
              href: linkTo({
                to: "/portal/properties/$propertyId",
                params: { propertyId: plan.property.id },
              }),
            },
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
        billHref={(billId) =>
          linkTo({ to: "/portal/bills/$billId", params: { billId } })
        }
      />

      <Section title="Plan details">
        <Card>
          <PlanDetails plan={plan} />
          <p className="border-t border-border pt-4 text-sm text-fg-muted">
            {paymentLine[plan.weeklyBill ?? "per_clean"]} We email a reminder
            the day before.
          </p>
        </Card>
      </Section>

      <Section
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
              end={<StatusBadge tone="info">Booked</StatusBadge>}
            />
          ))}
        </List>
      </Section>

      {plan.status !== "ended" && <AskToChange plan={plan} />}

      <EndPlan
        plan={plan}
        forClient
        endPath={`/api/service-plans/mine/${plan.id}/end`}
      />
    </div>
  );
}

// The plan as its Client reads it: when, large, every weekday of it (one
// answer to "when is my clean?"), then its facts in even columns across, each
// an icon, a value and what the value is. Three text styles, no more.
// (UX pass, #96)
function PlanDetails({ plan }: { plan: ServicePlanView }) {
  const [one] = plan.days;
  const several = plan.days.length > 1;
  const ended = plan.status === "ended";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <IconTile icon={CalendarClock} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-fg-muted">
            {recurrenceLabel[plan.recurrence]}
          </p>
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
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          icon={Receipt}
          label={several ? "Each week" : "Each clean"}
          value={formatMoney(several ? plan.roundTotalCents : one!.totalCents)}
          line={`${several ? "Each week" : "Each clean"}, tax included, ${plan.discountPercent}% off`}
        />
        {several ? (
          <Fact
            icon={Users}
            label="On site"
            value={plan.days.map((d) => formatHours(d.hoursOnSite)).join(" + ")}
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
                : "Deposit, comes off your last clean"
          }
        />
      </dl>
      <p className="text-sm text-fg-muted">
        Started {formatDate(plan.startedAt)}
        {plan.endedAt && ` · Ended ${formatDate(plan.endedAt)}`}
      </p>
    </div>
  );
}

// A different day, how often, or what's included: the Client says what
// they'd like, which reaches the Office as a Requested Quote for the home. The
// Office answers with a new Service Plan Quote; nothing changes until the
// Client accepts it.
function AskToChange({ plan }: { plan: ServicePlanView }) {
  const action = useAction("That didn't send. Please try again.");

  const ask = async (notes: string, close: () => void) => {
    const ok = await action.run(async () => {
      // the home's latest Condition, as the Client last gave it
      const me = await getJson<ClientView>("/api/clients/me");
      const home = me.properties.find((p) => p.id === plan.property.id)!;
      await postJson("/api/quotes/ask", {
        property: { existing: plan.property.id },
        serviceKey: plan.serviceKey,
        condition: home.condition,
        wantsRegularService: true,
        notes,
      });
    }, "Sent: we'll send you a new Service Plan Quote");
    if (ok) close();
  };

  return (
    <Section title="Change your plan">
      <Card>
        <ActionRow
          actions={
            <DialogTrigger>
              <Button variant="secondary">Ask to change</Button>
              <Dialog title="Ask to change your plan">
                {({ close }) => (
                  <Form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      void ask(String(form.get("notes")), close);
                    }}
                  >
                    <TextField
                      label="What would you like to change?"
                      name="notes"
                      multiline
                      isRequired
                      autoFocus
                    />
                    {action.problem && (
                      <Notice tone="danger">{action.problem}</Notice>
                    )}
                    <Actions>
                      <Button variant="quiet" onPress={close}>
                        Cancel
                      </Button>
                      <Button type="submit" isPending={action.isPending}>
                        Send
                      </Button>
                    </Actions>
                  </Form>
                )}
              </Dialog>
            </DialogTrigger>
          }
        >
          <p>
            A different day, how often, or what's included? Tell us, and we'll
            send you a new Service Plan Quote. Nothing changes until you accept
            it.
          </p>
        </ActionRow>
      </Card>
    </Section>
  );
}
