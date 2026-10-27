import { useLoaderData, useNavigate } from "@tanstack/react-router";
import type {
  OfficeQuote,
  PriceBreakdown,
  QuoteKind,
} from "@empire-cleaning/models";
import {
  Actions,
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
import { homeCrumbs } from "./PropertyScreen.tsx";
import {
  BookSiteVisit,
  SiteVisitBadge,
  visitSummary,
} from "./SiteVisitParts.tsx";
import { useStartDraft } from "./StartDraft.tsx";
import {
  addressOf,
  cleanTypeLabel,
  clientName,
  conditionLabel,
  conditionText,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
  propertySummary,
  wantedCleaning,
} from "../format.ts";

// What a Quote was asked for, in full, with the Suggested Price for both
// Clean Types and how each was worked out, afresh from the Price List as it
// is now; and its Revisions. #101 reshapes this into the Quote's own screen.
export function QuoteRequest() {
  const request = useLoaderData({ from: "/office/requests/$requestId" });
  const { client, property, suggested } = request;
  const asked = request.asked ?? {
    condition: null,
    wantsRegularService: false,
    weekdays: [],
    preferredTime: null,
    notes: null,
    addOns: [],
  };
  const stated = asked.condition;
  // a business states none: a Site Visit finds it
  const corrected = stated !== null && stated !== property.condition;
  const premises = property.kind === "commercial";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Requests", href: linkTo({ to: "/office/requests" }) },
            ...homeCrumbs(client, property),
            { label: "Quote Request" },
          ]}
        />
        <Heading level={1}>{clientName(client)}</Heading>
      </div>

      <Card
        title={addressOf(property)}
        description={propertySummary(property)}
        actions={
          <Link
            href={linkTo({
              to: "/office/properties/$propertyId",
              params: { propertyId: property.id },
            })}
          >
            View Property
          </Link>
        }
      >
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Asked</dt>
          <dd>{formatDate(request.createdAt)}</dd>
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

      <SiteVisit request={request} />
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
        {premises && (property.floorArea === null || !property.condition) && (
          <Notice>
            {property.floorArea === null
              ? "The floor area isn't known yet, so this is the Minimum Charge."
              : "No Condition is recorded yet, so this assumes moderate."}{" "}
            Record what you know on the{" "}
            <Link
              href={linkTo({
                to: "/office/properties/$propertyId",
                params: { propertyId: property.id },
              })}
            >
              Property
            </Link>
            .
          </Notice>
        )}
        <p className="text-sm text-fg-muted">
          Worked out from Price List version {suggested.priceListVersion}, using
          the {premises ? "premises'" : "home's"} details and Condition as they
          are now. It becomes final only in a Quote.
        </p>
      </section>
    </div>
  );
}

// The Quote's Sent Revisions, newest first, and the way on: while it's
// Requested, drafting its first Revision, which sets its kind (once the
// home's First Clean is Completed, or for business premises at any time,
// ADR-0014, either kind); after that, the Quote's own screen
function Quotes({ request }: { request: OfficeQuote }) {
  const navigate = useNavigate();
  const { start, starting, failure } = useStartDraft();
  const requested = request.status === "requested";
  const open = () =>
    navigate({
      to: "/office/quotes/$quoteId",
      params: { quoteId: request.id },
    });
  const eitherKind =
    request.firstCleanCompleted || request.property.kind === "commercial";
  const draftButton = (kind: QuoteKind, label: string, primary: boolean) => (
    <Button
      variant={primary ? "primary" : "secondary"}
      isPending={starting?.kind === kind}
      isDisabled={starting !== undefined}
      onPress={() => void start({ quoteId: request.id, kind })}
    >
      {label}
    </Button>
  );

  return (
    <Card
      title="Quotes"
      actions={
        requested ? (
          // both kinds go below, where they can wrap on a phone
          !eitherKind && draftButton("one_off", "Draft a Quote", true)
        ) : (
          <Button variant="secondary" onPress={() => void open()}>
            {request.draft ? "Continue the Draft" : "Open the Quote"}
          </Button>
        )
      }
    >
      {requested && eitherKind && (
        <Actions>
          {draftButton("one_off", "Draft a one-off Quote", false)}
          {draftButton("service_plan", "Draft a Service Plan Quote", true)}
        </Actions>
      )}
      {requested && request.homePlanId && (
        <Notice>
          <p>
            This home has a{" "}
            <Link
              href={linkTo({
                to: "/office/service-plans/$planId",
                params: { planId: request.homePlanId },
              })}
            >
              Service Plan
            </Link>
            . A Service Plan Quote changes its terms once the Client accepts it.
          </p>
        </Notice>
      )}
      {failure && <Notice tone="danger">{failure}</Notice>}
      {request.status === "accepted" && (
        <Notice tone="success">
          The Client accepted this Quote, so it's booked. They can ask for a new
          Quote.
        </Notice>
      )}
      {request.status === "declined" && (
        <Notice>
          The Client declined, so this Quote has ended. They can ask for a new
          Quote.
        </Notice>
      )}
      {request.status === "turned_down" && (
        <Notice>
          This Quote was Turned Down. The Client can ask for a new Quote.
        </Notice>
      )}
      <List
        aria-label="Quotes for this request"
        onAction={() => void open()}
        renderEmptyState={() => (
          <p className="p-6 text-center text-fg-muted">No Quotes yet.</p>
        )}
      >
        {request.revisions.map((revision) => (
          <ListItem
            key={revision.id}
            id={revision.id}
            title={`Revision ${revision.number}: ${formatMoney(revision.headlineTotalCents)}`}
            description={`Sent ${formatDate(revision.sentAt)} · for ${formatDateTime(revision.proposedStartsAt)}`}
            end={
              revision.id === request.offer?.id && (
                <QuoteStatusBadge status={request.status} />
              )
            }
          />
        ))}
      </List>
    </Card>
  );
}

// Business premises are seen before they're quoted (ADR-0014): the Office
// books a Site Visit, or records findings it knows already on the Property.
// A home may have one too. Shown while nothing of the Quote is Sent.
function SiteVisit({ request }: { request: OfficeQuote }) {
  const navigate = useNavigate();
  const { property, bookedSiteVisit: booked } = request;
  if (request.status !== "requested" && request.status !== "draft") {
    return null;
  }
  const premises = property.kind === "commercial";
  if (!premises && !booked) {
    return (
      <Card
        title="Site Visit"
        description="Optional for a home: book one to see it before quoting."
        actions={<BookSiteVisit quoteId={request.id} />}
      />
    );
  }

  return (
    <Card
      title="Site Visit"
      actions={
        request.siteVisit === "needed" && (
          <BookSiteVisit quoteId={request.id} primary />
        )
      }
    >
      {request.siteVisit === "needed" && (
        <Notice>
          <p>
            Business premises are seen before they're quoted, so a Quote can't
            be sent yet. Book a Site Visit, or if you know the premises already,
            record what you know on the{" "}
            <Link
              href={linkTo({
                to: "/office/properties/$propertyId",
                params: { propertyId: property.id },
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
      {premises && request.findingsRecorded && !booked && (
        <p className="text-fg-muted">
          Its findings are recorded, so a Quote can be sent.
        </p>
      )}
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
  // breakdowns from before #72 have no kind: they're all homes
  const premises = b.propertyKind === "commercial";

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
          <Row
            label={premises ? "The premises" : "The home"}
            value={formatHours(homeHours)}
            strong
          />
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
