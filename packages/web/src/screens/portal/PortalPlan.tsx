import { useState, type Key } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type { ClientView, ServicePlanView } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  List,
  ListItem,
  Notice,
  StatusBadge,
  TextField,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, getJson, postJson } from "../../api.ts";
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

      {plan.status !== "ended" && <AskToChange plan={plan} />}

      <EndPlan
        plan={plan}
        forClient
        endPath={`/api/service-plans/mine/${plan.id}/end`}
      />
    </div>
  );
}

// A different day, how often, or what's included: the Client says what
// they'd like, which reaches the Office as a Quote Request for the home. The
// Office answers with a new Service Plan Quote; nothing changes until the
// Client accepts it.
function AskToChange({ plan }: { plan: ServicePlanView }) {
  const [problem, setProblem] = useState<string>();
  const [isSending, setSending] = useState(false);

  const ask = async (notes: string, close: () => void) => {
    setSending(true);
    setProblem(undefined);
    try {
      // the home's latest Condition, as the Client last gave it
      const me = await getJson<ClientView>("/api/clients/me");
      const home = me.properties.find((p) => p.id === plan.property.id)!;
      await postJson("/api/quote-requests", {
        property: { existing: plan.property.id },
        condition: home.condition,
        wantsRegularService: true,
        notes,
      });
      showToast({
        tone: "success",
        title: "Sent: we'll send you a new Service Plan Quote",
      });
      close();
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "That didn't send. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      title="Change your plan"
      description="A different day, how often, or what's included? Tell us, and we'll send you a new Service Plan Quote. Nothing changes until you accept it."
    >
      <DialogTrigger>
        <Button variant="secondary" className="self-start">
          Ask to change
        </Button>
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
              {problem && <Notice tone="danger">{problem}</Notice>}
              <Actions>
                <Button variant="secondary" onPress={close}>
                  Cancel
                </Button>
                <Button type="submit" isPending={isSending}>
                  Send
                </Button>
              </Actions>
            </Form>
          )}
        </Dialog>
      </DialogTrigger>
    </Card>
  );
}
