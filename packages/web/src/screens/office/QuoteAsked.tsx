import { useState } from "react";
import { CircleX } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type {
  OfficeQuote,
  PriceBreakdown,
  QuoteKind,
  TurnDownReason,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  Link,
  List,
  ListItem,
  Notice,
  Radio,
  RadioGroup,
  StatusBadge,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  BookSiteVisit,
  SiteVisitBadge,
  visitSummary,
} from "./SiteVisitParts.tsx";
import { useStartDraft } from "./StartDraft.tsx";
import {
  cleanTypeLabel,
  conditionLabel,
  conditionText,
  formatDate,
  formatHours,
  formatMoney,
  wantedCleaning,
} from "../format.ts";

// The parts of a Quote's page about what was asked and getting to its first
// Revision: the ask itself, its Site Visit, the Suggested Price, drafting,
// and Turning it Down (ADR-0017)

const propertyLink = (quote: OfficeQuote) =>
  linkTo({
    to: "/office/properties/$propertyId",
    params: { propertyId: quote.property.id },
  });

// what the Client (or a caller) asked for, unchanged; none on a Quote the
// Office offered unprompted
export function AskedCard({ quote }: { quote: OfficeQuote }) {
  const { asked, property } = quote;
  if (!asked) return null;
  const stated = asked.condition;
  // a business states none: a Site Visit finds it
  const corrected = stated !== null && stated !== property.condition;
  const premises = property.kind === "commercial";

  return (
    <Card
      title="What was asked"
      actions={<Link href={propertyLink(quote)}>View Property</Link>}
    >
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">Asked</dt>
        <dd>
          {formatDate(quote.createdAt)}
          {quote.origin === "caller" && ", by phone"}
        </dd>
        <dt className="font-semibold">Condition</dt>
        <dd>
          {conditionText(property.condition)}
          {corrected && (
            <span className="text-fg-muted">
              {" "}
              (the Client said {conditionLabel[stated].toLowerCase()})
            </span>
          )}
        </dd>
        {premises ? (
          <>
            <dt className="font-semibold">Cleaning wanted</dt>
            <dd>{wantedCleaning(asked)}</dd>
          </>
        ) : (
          <>
            <dt className="font-semibold">Extras</dt>
            <dd>
              {asked.addOns.length > 0
                ? asked.addOns.map((a) => a.name).join(", ")
                : "None"}
            </dd>
            <dt className="font-semibold">Regular visits</dt>
            <dd>
              {asked.wantsRegularService
                ? "Wanted after the first clean"
                : "Not asked for"}
            </dd>
          </>
        )}
        {asked.notes && (
          <>
            <dt className="font-semibold">Notes</dt>
            <dd className="whitespace-pre-line">{asked.notes}</dd>
          </>
        )}
      </dl>
    </Card>
  );
}

// A Requested Quote's way on: drafting its first Revision, which sets its
// kind (once the home's First Clean is Completed, or for business premises
// at any time, ADR-0014, either kind)
export function FirstRevision({ quote }: { quote: OfficeQuote }) {
  const { start, starting, failure } = useStartDraft();
  const eitherKind =
    quote.firstCleanCompleted || quote.property.kind === "commercial";
  const draftButton = (kind: QuoteKind, label: string, primary: boolean) => (
    <Button
      variant={primary ? "primary" : "secondary"}
      isPending={starting?.kind === kind}
      isDisabled={starting !== undefined}
      onPress={() => void start({ quoteId: quote.id, kind })}
    >
      {label}
    </Button>
  );

  return (
    <Card
      title="Draft the Quote"
      description="Its first Revision. Nothing reaches the Client until you send it."
      actions={
        // both kinds go below, where they can wrap on a phone
        !eitherKind && draftButton("one_off", "Draft a Quote", true)
      }
    >
      {eitherKind && (
        <Actions>
          {draftButton("one_off", "Draft a one-off Quote", false)}
          {draftButton("service_plan", "Draft a Service Plan Quote", true)}
        </Actions>
      )}
      {quote.homePlanId && (
        <Notice>
          <p>
            This home has a{" "}
            <Link
              href={linkTo({
                to: "/office/service-plans/$planId",
                params: { planId: quote.homePlanId },
              })}
            >
              Service Plan
            </Link>
            . A Service Plan Quote changes its terms once the Client accepts it.
          </p>
        </Notice>
      )}
      {failure && <Notice tone="danger">{failure}</Notice>}
    </Card>
  );
}

// Business premises are seen before they're quoted (ADR-0014): the Office
// books a Site Visit, or records findings it knows already on the Property.
// A home may have one too. Shown while nothing of the Quote is Sent.
export function SiteVisitCard({ quote }: { quote: OfficeQuote }) {
  const navigate = useNavigate();
  const { property, bookedSiteVisit: booked } = quote;
  if (quote.status !== "requested" && quote.status !== "draft") {
    return null;
  }
  const premises = property.kind === "commercial";
  if (!premises && !booked) {
    return (
      <Card
        title="Site Visit"
        description="Optional for a home: book one to see it before quoting."
        actions={<BookSiteVisit quoteId={quote.id} />}
      />
    );
  }

  return (
    <Card
      title="Site Visit"
      actions={
        quote.siteVisit === "needed" && (
          <BookSiteVisit quoteId={quote.id} primary />
        )
      }
    >
      {quote.siteVisit === "needed" && (
        <Notice>
          <p>
            Business premises are seen before they're quoted, so a Quote can't
            be sent yet. Book a Site Visit, or if you know the premises already,
            record what you know on the{" "}
            <Link
              href={linkTo({
                to: "/office/properties/$propertyId",
                params: { propertyId: quote.property.id },
                search: { tab: "visit" },
              })}
            >
              Property
            </Link>
            .
          </p>
        </Notice>
      )}
      {booked && (
        <List
          aria-label="Booked Site Visit"
          onAction={() =>
            void navigate({
              to: "/office/site-visits/$visitId",
              params: { visitId: booked.id },
            })
          }
        >
          <ListItem
            id={booked.id}
            title={visitSummary(booked)}
            description="Open it to move it, cancel it or record what it found."
            end={<SiteVisitBadge status={booked.status} />}
          />
        </List>
      )}
      {premises && quote.findingsRecorded && !booked && (
        <p className="text-fg-muted">
          Its findings are recorded, so a Quote can be sent.
        </p>
      )}
    </Card>
  );
}

// why a Quote was Turned Down, as the Office reads it; the Client's email
// says the same in its own words
export const turnDownLabel: Record<TurnDownReason, string> = {
  out_of_area: "Outside the area we clean",
  out_of_scope: "More than the cleaning we offer",
  no_capacity: "More than we have room for at the moment",
};

// Turns Down a Requested or Draft Quote, with the reason the Client is
// emailed; once a Revision is Sent, only the Client's Decline or Expiry
// closes it
export function TurnDownQuote({ quote }: { quote: OfficeQuote }) {
  const [reason, setReason] = useState<TurnDownReason>();
  const action = useAction("The Quote wasn't Turned Down. Please try again.");

  const turnDown = async (close: () => void) => {
    if (!reason) {
      action.fail("Choose why it's being Turned Down.");
      return;
    }
    const ok = await action.run(
      () =>
        postJson<OfficeQuote>(`/api/quotes/${quote.id}/turn-down`, {
          reason,
        }),
      "Quote Turned Down",
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="text" size="sm">
        <CircleX aria-hidden size={16} />
        Turn Down
      </Button>
      <Dialog title="Turn Down this Quote?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              {quote.client.email
                ? `${quote.client.name} is emailed to say we can't quote for it, and why. They can ask again later.`
                : `${quote.client.name} has no email, so tell them yourself. They can ask again later.`}
            </p>
            <RadioGroup
              label="Why?"
              value={reason ?? null}
              onChange={(value) => setReason(value as TurnDownReason)}
            >
              {(Object.keys(turnDownLabel) as TurnDownReason[]).map((r) => (
                <Radio key={r} value={r}>
                  {turnDownLabel[r]}
                </Radio>
              ))}
            </RadioGroup>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() => void turnDown(close)}
              >
                Turn Down
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}

// The Suggested Price for both Clean Types and how each was worked out,
// afresh from the Price List as it is now: what a Requested Quote would be
// drafted at
export function SuggestedPrices({ quote }: { quote: OfficeQuote }) {
  const { property, suggested } = quote;
  const premises = property.kind === "commercial";
  return (
    <section aria-labelledby="suggested-title" className="flex flex-col gap-4">
      <Heading level={2} id="suggested-title">
        Suggested Price
      </Heading>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* business premises have only their commercial cleaning */}
        {suggested.deep && <PriceCard breakdown={suggested.deep} recommended />}
        <PriceCard breakdown={suggested.standard} />
      </div>
      {premises && (property.floorArea === null || !property.condition) && (
        <Notice>
          {property.floorArea === null
            ? "The floor area isn't known yet, so this is the Minimum Charge."
            : "No Condition is recorded yet, so this assumes moderate."}{" "}
          Record what you know on the{" "}
          <Link href={propertyLink(quote)}>Property</Link>.
        </Notice>
      )}
      <p className="text-sm text-fg-muted">
        Worked out from Price List version {suggested.priceListVersion}, using
        the {premises ? "premises'" : "home's"} details and Condition as they
        are now. It becomes final only in a Sent Revision.
      </p>
    </section>
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
  // breakdowns from before #72 have no kind: they're all homes
  const premises = b.propertyKind === "commercial";

  return (
    <Card
      title={b.serviceName ?? cleanTypeLabel[b.cleanType]}
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
          <Row
            label={premises ? "The premises" : "The home"}
            value={formatHours(homeHours)}
            strong
          />
          <Row label={`× Condition (${b.conditionMultiplier})`} value="" />
          {/* saved before each Service had its own hours (ADR-0018) */}
          {b.cleanTypeMultiplier !== undefined && !premises && (
            <Row
              label={`× ${b.serviceName ?? cleanTypeLabel[b.cleanType]} (${b.cleanTypeMultiplier})`}
              value=""
            />
          )}
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
            label={`× ${formatMoney(b.hourlyRateCents)} an hour${premises ? " (commercial)" : ""}, to the whole dollar`}
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
