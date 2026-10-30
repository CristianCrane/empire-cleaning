import type { Key } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  CalendarClock,
  FileText,
  House,
  KeyRound,
  Ruler,
  Sparkles,
} from "lucide-react";
import type { PropertyView } from "@empire-cleaning/models";
import {
  ActionRow,
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
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
  type StatusTone,
  TextField,
} from "@empire-cleaning/ui";
import { patchJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  addressOf,
  conditionLabel,
  dayOfInstant,
  formatDateTime,
  formatFloorArea,
  formatShortDay,
  propertySummary,
  recurrenceLabel,
} from "../format.ts";
import { Fact } from "../Fact.tsx";
import { planWhen, quoteTitle, standingOf } from "./properties.ts";

const planStatus: Record<string, { tone: StatusTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  on_hold: { tone: "warning", label: "On Hold" },
  ended: { tone: "danger", label: "Ended" },
};

// a Quote's state as its Client sees it: one being drafted is still asked for
const quoteStatus: Record<string, { tone: StatusTone; label: string }> = {
  requested: { tone: "info", label: "Asked for" },
  draft: { tone: "info", label: "Asked for" },
  sent: { tone: "warning", label: "To answer" },
  accepted: { tone: "success", label: "Accepted" },
  declined: { tone: "neutral", label: "Declined" },
  expired: { tone: "neutral", label: "Expired" },
  turned_down: { tone: "neutral", label: "Turned Down" },
};

const shortDayOf = (iso: string) => formatShortDay(dayOfInstant(iso));

// One of the Client's homes, as their plan's and cleans' pages read: what it
// is, large, then its facts across, with how we get in, changed in a dialog;
// then its Service Plans and Quotes. Its size and rooms change only with a
// new Quote, which prices them. (UX pass, #96)
export function PortalProperty() {
  const data = useLoaderData({ from: "/portal/properties/$propertyId" });
  const { property: p } = data;
  const navigate = useNavigate();
  const standing = standingOf(p, data);
  const premises = p.kind === "commercial";
  const plans = data.plans
    .filter((plan) => plan.property.id === p.id)
    // an Ended plan after the live one
    .sort(
      (a, b) => Number(a.status === "ended") - Number(b.status === "ended"),
    );
  const quotes = data.quotes.filter((q) => q.property.id === p.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Your details", href: linkTo({ to: "/portal/details" }) },
            { label: p.street },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>{p.street}</Heading>
          <StatusBadge tone={standing.tone}>{standing.label}</StatusBadge>
        </div>
        <p className="text-fg-muted">{addressOf(p)}</p>
      </div>

      <Section
        title={premises ? "Premises details" : "Home details"}
        actions={<EditAccess property={p} />}
      >
        <Card>
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <IconTile icon={premises ? Building2 : House} size="lg" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-fg-muted">
                  {premises ? "Business premises" : "Your home"}
                </p>
                <p className="text-xl font-semibold text-fg">
                  {propertySummary(p)}
                </p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact
                icon={Ruler}
                label="Floor area"
                value={
                  p.floorArea === null
                    ? "Not known yet"
                    : formatFloorArea(p.floorArea)
                }
              />
              <Fact
                icon={Sparkles}
                label="Condition"
                value={
                  p.condition ? conditionLabel[p.condition] : "Not known yet"
                }
                line="Condition, at the last visit"
              />
              <Fact
                icon={KeyRound}
                label="How we get in"
                value={
                  <span className="whitespace-pre-line">
                    {p.accessInstructions || "Not added yet"}
                  </span>
                }
                line="How we get in: only your Cleaners see it"
                className="sm:col-span-2"
              />
            </dl>
            <p className="border-t border-border pt-4 text-sm text-fg-muted">
              To change its size or rooms, ask for a new Quote: they set the
              price.
            </p>
          </div>
        </Card>
      </Section>

      <Section title={plans.length > 1 ? "Service Plans" : "Service Plan"}>
        {plans.length > 0 ? (
          <List
            aria-label="Service Plans"
            onAction={(id: Key) =>
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
                start={<IconTile icon={CalendarClock} />}
                title={`${recurrenceLabel[plan.recurrence]}, ${planWhen(plan)}`}
                description={[
                  [...new Set(plan.days.map((d) => d.serviceName))].join(", "),
                  plan.nextStartsAt &&
                    `next clean ${formatDateTime(plan.nextStartsAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                end={
                  <StatusBadge tone={planStatus[plan.status]!.tone}>
                    {planStatus[plan.status]!.label}
                  </StatusBadge>
                }
              />
            ))}
          </List>
        ) : (
          <Card>
            <ActionRow
              actions={
                <ButtonLink
                  variant="secondary"
                  href={linkTo({ to: "/portal/request" })}
                >
                  Request a Quote
                </ButtonLink>
              }
            >
              <p>
                No Service Plan here yet. Ask for a Quote for regular cleans,
                with money off each one.
              </p>
            </ActionRow>
          </Card>
        )}
      </Section>

      {quotes.length > 0 && (
        <Section title="Quotes">
          <List
            aria-label="Quotes"
            onAction={(id: Key) =>
              navigate({
                to: "/portal/quotes/$quoteId",
                params: { quoteId: String(id) },
              })
            }
          >
            {quotes.map((q) => (
              <ListItem
                key={q.id}
                id={q.id}
                start={<IconTile icon={FileText} />}
                title={quoteTitle(q)}
                description={
                  q.sentAt
                    ? `Sent ${shortDayOf(q.sentAt)}`
                    : `Asked for ${shortDayOf(q.createdAt)}`
                }
                end={
                  <StatusBadge tone={quoteStatus[q.status]!.tone}>
                    {quoteStatus[q.status]!.label}
                  </StatusBadge>
                }
              />
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}

function EditAccess({ property }: { property: PropertyView }) {
  const action = useAction(
    "Your Access Instructions weren't saved. Please try again.",
  );

  const save = async (text: string, close: () => void) => {
    const ok = await action.run(
      () =>
        patchJson(`/api/properties/${property.id}/access-instructions`, {
          accessInstructions: text || null,
        }),
      "Access Instructions saved",
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="text">
        <KeyRound aria-hidden size={18} />
        Edit how we get in
      </Button>
      <Dialog title="How we get in">
        {({ close }) => (
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void save(String(form.get("access")), close);
            }}
          >
            <TextField
              label="How do we get in?"
              name="access"
              multiline
              autoFocus
              description="Door codes, where the key is, parking. Only your Cleaners see this."
              defaultValue={property.accessInstructions ?? ""}
            />
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Cancel
              </Button>
              <Button type="submit" isPending={action.isPending}>
                Save Access Instructions
              </Button>
            </Actions>
          </Form>
        )}
      </Dialog>
    </DialogTrigger>
  );
}
