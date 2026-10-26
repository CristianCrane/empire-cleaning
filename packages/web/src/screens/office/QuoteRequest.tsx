import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type {
  PriceBreakdown,
  QuoteKind,
  QuoteRequestDetail,
} from "@empire-cleaning/models";
import {
  Breadcrumbs,
  Button,
  Card,
  Heading,
  Link,
  List,
  ListItem,
  Notice,
  StatusBadge,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { QuoteStatusBadge } from "../QuoteParts.tsx";
import { useStartDraft } from "./StartDraft.tsx";
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
} from "../format.ts";

// one Quote Request in full, with the Suggested Price for both Clean Types and
// how each was worked out. Nothing here is a Quote yet: it's worked out afresh
// from the Price List as it is now.
export function QuoteRequest() {
  const request = useLoaderData({ from: "/office/requests/$requestId" });
  const { client, property, suggested } = request;
  const conditionNow = conditionLabel[property.condition];
  const corrected = request.statedCondition !== property.condition;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Requests", href: linkTo({ to: "/office/requests" }) },
            { label: client.name },
          ]}
        />
        <Heading level={1}>{client.name}</Heading>
      </div>

      <Card
        title={addressOf(property)}
        description={homeSummary(property)}
        actions={
          <Link
            href={linkTo({
              to: "/office/clients/$clientId",
              params: { clientId: client.id },
            })}
          >
            View Client
          </Link>
        }
      >
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Asked</dt>
          <dd>{formatDate(request.createdAt)}</dd>
          <dt className="font-semibold">Condition</dt>
          <dd>
            {conditionNow}
            {corrected && (
              <span className="text-fg-muted">
                {" "}
                (the Client said{" "}
                {conditionLabel[request.statedCondition].toLowerCase()})
              </span>
            )}
          </dd>
          <dt className="font-semibold">Extras</dt>
          <dd>
            {request.addOns.length > 0
              ? request.addOns.map((a) => a.name).join(", ")
              : "None"}
          </dd>
          <dt className="font-semibold">Regular visits</dt>
          <dd>
            {request.wantsRegularService
              ? "Wanted after the first clean"
              : "Not asked for"}
          </dd>
          {request.notes && (
            <>
              <dt className="font-semibold">Notes</dt>
              <dd className="whitespace-pre-line">{request.notes}</dd>
            </>
          )}
        </dl>
      </Card>

      <Quotes request={request} />

      <section
        aria-labelledby="suggested-title"
        className="flex flex-col gap-4"
      >
        <Heading level={2} id="suggested-title">
          Suggested Price
        </Heading>
        <div className="grid gap-4 lg:grid-cols-2">
          <PriceCard breakdown={suggested.deep} recommended />
          <PriceCard breakdown={suggested.standard} />
        </div>
        <p className="text-sm text-fg-muted">
          Worked out from Price List version {suggested.priceListVersion}, using
          the home's details and Condition as they are now. It becomes final
          only in a Quote.
        </p>
      </section>
    </div>
  );
}

// The request's Quotes, newest first, and the way to draft the next one
// while it's open: once the home's First Clean is Completed, it can be
// answered with a one-off Quote or a Service Plan Quote
function Quotes({ request }: { request: QuoteRequestDetail }) {
  const navigate = useNavigate();
  const { start, starting, failure } = useStartDraft();
  const isOpen = request.state !== "booked" && request.state !== "ended";
  // a request has at most one Draft, of either kind
  const draft = request.quotes.find((q) => q.status === "draft");
  const open = (quoteId: string) =>
    navigate({ to: "/office/quotes/$quoteId", params: { quoteId } });
  const draftButton = (kind: QuoteKind, label: string, primary: boolean) => (
    <Button
      variant={primary ? "primary" : "secondary"}
      isPending={starting?.kind === kind}
      isDisabled={starting !== undefined}
      onPress={() => void start({ quoteRequestId: request.id, kind })}
    >
      {label}
    </Button>
  );

  return (
    <Card
      title="Quotes"
      actions={
        isOpen &&
        (draft ? (
          <Button variant="secondary" onPress={() => void open(draft.id)}>
            Continue the Draft
          </Button>
        ) : request.firstCleanCompleted ? (
          <div className="flex flex-wrap gap-2">
            {draftButton("one_off", "Draft a one-off Quote", false)}
            {draftButton("service_plan", "Draft a Service Plan Quote", true)}
          </div>
        ) : (
          draftButton("one_off", "Draft a Quote", true)
        ))
      }
    >
      {failure && <Notice tone="danger">{failure}</Notice>}
      {request.state === "booked" && (
        <Notice tone="success">
          The Client accepted a Quote, so this request is booked. They can ask
          for a new Quote.
        </Notice>
      )}
      {request.state === "ended" && (
        <Notice>
          The Client declined, so this request has ended. They can ask for a new
          Quote.
        </Notice>
      )}
      <List
        aria-label="Quotes for this request"
        onAction={(id) => void open(String(id))}
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">No Quotes yet.</p>
        )}
      >
        {request.quotes.map((quote) => (
          <ListItem
            key={quote.id}
            id={quote.id}
            title={quoteHeadline(quote)}
            description={
              quote.sentAt
                ? `Sent ${formatDate(quote.sentAt)} · for ${formatDateTime(quote.proposedStartsAt!)}`
                : `Started ${formatDate(quote.createdAt)}`
            }
            end={<QuoteStatusBadge status={quote.status} />}
          />
        ))}
      </List>
    </Card>
  );
}

function PriceCard({
  breakdown,
  recommended = false,
}: {
  breakdown: PriceBreakdown;
  recommended?: boolean;
}) {
  const b = breakdown;
  const homeHours = b.homeHours.reduce((sum, part) => sum + part.hours, 0);

  return (
    <Card
      title={cleanTypeLabel[b.cleanType]}
      headingLevel={3}
      actions={
        recommended && <StatusBadge tone="success">Recommended</StatusBadge>
      }
    >
      <div className="flex flex-col gap-1">
        <p className="font-display text-4xl font-bold tracking-wide">
          {formatMoney(b.totalCents)}
        </p>
        <p className="text-sm text-fg-muted">
          {formatMoney(b.priceCents)} + {formatMoney(b.taxCents)} tax (
          {b.taxPercent}%) · {formatHours(b.labourHours)} of Labour
        </p>
      </div>

      {b.minimumApplied && (
        <Notice>
          Worked out at {formatMoney(b.workedOutCents)}, so the Minimum Charge
          of {formatMoney(b.minimumChargeCents)} applies.
        </Notice>
      )}

      <div className="flex flex-col gap-2">
        <Heading level={4}>How it's worked out</Heading>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          {b.homeHours.map((part) => (
            <Row
              key={part.label}
              label={part.label}
              value={formatHours(part.hours)}
            />
          ))}
          <Row label="The home" value={formatHours(homeHours)} strong />
          <Row label={`× Condition (${b.conditionMultiplier})`} value="" />
          <Row
            label={`× ${cleanTypeLabel[b.cleanType]} (${b.cleanTypeMultiplier})`}
            value=""
          />
          {b.addOns.map((addOn) => (
            <Row
              key={addOn.key}
              label={`+ ${addOn.name}${addOn.taxExempt ? " (tax-exempt)" : ""}`}
              value={formatHours(addOn.hours)}
            />
          ))}
          <Row
            label="Labour Hours, rounded up to the quarter-hour"
            value={formatHours(b.labourHours)}
            strong
          />
          <Row
            label={`× ${formatMoney(b.hourlyRateCents)} an hour, to the whole dollar`}
            value={formatMoney(b.workedOutCents)}
          />
          <Row
            label="Suggested Price, before tax"
            value={formatMoney(b.priceCents)}
            strong
          />
        </dl>
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <>
      <dt className={strong ? "font-semibold" : "text-fg-muted"}>{label}</dt>
      <dd
        className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </dd>
    </>
  );
}
