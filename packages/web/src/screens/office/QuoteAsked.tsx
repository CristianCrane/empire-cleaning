import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  Globe,
  ClipboardList,
  Ruler,
  Sparkles,
  BedDouble,
} from "lucide-react";
import type {
  OfficeQuote,
  PriceBreakdown,
  QuoteKind,
  QuoteSource,
  TurnDownReason,
} from "@empire-cleaning/models";
import { needsVisit, placeOwner, formats } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  Link,
  Notice,
  Radio,
  RadioGroup,
  Facts,
  Fact,
  Figure,
  Figures,
  Fold,
  type Alert,
  type DialogState,
  Line,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { useStartDraft } from "./StartDraft.tsx";
import { addressOf, formatHours, roomsText, screenWords } from "../format.ts";
import { homeIcon } from "../icons.ts";
import { AskedRows, PriceHead } from "../QuoteParts.tsx";
import { working } from "./WorkedOutQuote.tsx";

const { conditionLabel, conditionText, formatFloorArea, propertySummary } =
  screenWords.en;

const { formatDate, formatMoney } = formats.en;

// The parts of a Quote's page about what was asked and getting to its first
// Revision: the ask itself, its Site Visit, the Suggested Price, drafting,
// and Turning it Down (ADR-0017)

const propertyLink = (quote: OfficeQuote) =>
  linkTo({
    to: "/office/properties/$propertyId",
    params: { propertyId: quote.property.id },
  });

// where on the landing site a Guest asked from (#185), and the link that
// brought them, by its campaign tags: "The website, /queens/, via gbp
// (cpc, spring)"
const sourceText = ({
  page,
  utmSource,
  utmMedium,
  utmCampaign,
}: QuoteSource) => {
  const more = [utmMedium, utmCampaign].filter(Boolean).join(", ");
  return [
    `The website, ${page}`,
    utmSource && `, via ${utmSource}`,
    more && ` (${more})`,
  ]
    .filter(Boolean)
    .join("");
};

// what was asked, in a line: "Deep Clean · Apartment · 2 bedrooms · 1
// bathroom · moderate". A business's condition is left out until its Site
// Visit finds one, as its facts say "Not known yet" where it's named
export const askedSummary = ({ asked, property }: OfficeQuote) => (
  <Line
    parts={[
      asked?.service.name,
      propertySummary(property),
      property.condition && conditionText(property.condition).toLowerCase(),
    ]}
  />
);

// what the Client (or a caller) asked for, unchanged, and the home it's
// for (WEB-8, WEB-A); none on a Quote the Office offered unprompted
export function AskedFacts({ quote }: { quote: OfficeQuote }) {
  const { asked, property } = quote;
  if (!asked) return null;
  const stated = asked.condition;
  // a business states none: a Site Visit finds it
  const corrected = stated !== null && stated !== property.condition;
  const premises = property.kind === "commercial";

  return (
    <Facts>
      <Fact
        icon={homeIcon(property.kind)}
        label="Property"
        value={<Link href={propertyLink(quote)}>{addressOf(property)}</Link>}
        line={propertySummary(property)}
      />
      <Fact
        icon={CalendarDays}
        label="Asked"
        value={`${formatDate(quote.createdAt)}${quote.origin === "caller" ? ", by phone" : ""}`}
      />
      {quote.source && (
        <Fact icon={Globe} label="From" value={sourceText(quote.source)} />
      )}
      <Fact icon={ClipboardList} label="Service" value={asked.service.name} />
      {asked.area !== null && (
        <Fact
          icon={Ruler}
          label="Area"
          value={`About ${formatFloorArea(asked.area)}`}
        />
      )}
      <Fact
        icon={Sparkles}
        label="Condition"
        value={conditionText(property.condition)}
        line={
          corrected
            ? `Condition: the client said ${conditionLabel[stated].toLowerCase()}`
            : undefined
        }
      />
      {/* a Guest's ask gives a home without them none (#243): the Office
          records them */}
      {property.kind !== "commercial" &&
        property.bedrooms === null &&
        asked.rooms && (
          <Fact
            icon={BedDouble}
            label="Rooms"
            value="Not recorded yet"
            line={`Rooms: the client said ${roomsText(asked.rooms)}`}
          />
        )}
      <AskedRows asked={asked} premises={premises} />
    </Facts>
  );
}

// Asks which kind a Requested Quote's first Revision is, where either can
// be, and drafts it: the Quote's Draft the quote
export function WhichKindDialog({
  quote,
  ...state
}: { quote: OfficeQuote } & Partial<DialogState>) {
  const { start, starting } = useStartDraft();
  const draft = (kind: QuoteKind) => void start({ quoteId: quote.id, kind });
  return (
    <Dialog title="Which kind of quote?" {...state}>
      <p>
        A one-off clean, or a cleaning plan of regular cleans at a discount.
      </p>
      <Actions>
        <Button
          variant="quiet"
          isPending={starting === "one_off"}
          isDisabled={starting !== undefined}
          onPress={() => draft("one_off")}
        >
          A one-off quote
        </Button>
        <Button
          isPending={starting === "service_plan"}
          isDisabled={starting !== undefined}
          onPress={() => draft("service_plan")}
        >
          A cleaning plan quote
        </Button>
      </Actions>
    </Dialog>
  );
}

// A Service seen first is seen before it's quoted (ADR-0018), for a home
// too: why the Quote's next step is Book a site visit, and the other way,
// recording findings the Office knows already on the Property
export const seeThePremises = (quote: OfficeQuote): Alert => ({
  key: "see",
  tone: "warning",
  children: (
    <p>
      <strong>{needsVisit(quote.service.name)}</strong> If you know what it
      would find already, record it on{" "}
      <Link href={propertyLink(quote)}>
        {placeOwner(quote.property.kind)} page
      </Link>{" "}
      instead.
    </p>
  ),
});

// why a Quote was Turned Down, as the Office reads it; the Client's email
// says the same in its own words
export const turnDownLabel: Record<TurnDownReason, string> = {
  out_of_area: "Outside the area we clean",
  out_of_scope: "Not work we take on",
  no_capacity: "We're fully booked",
};

// Turns Down a Requested or Draft Quote, with the reason the Client is
// emailed; once a Revision is Sent, only the Client's Decline or Expiry
// closes it
export function TurnDownQuote({
  quote,
  ...state
}: { quote: OfficeQuote } & DialogState) {
  const [reason, setReason] = useState<TurnDownReason>();
  const action = useAction("The quote wasn't turned down. Please try again.");

  const turnDown = async (close: () => void) => {
    if (!reason) {
      action.fail("Pick why you're turning it down.");
      return;
    }
    const ok = await action.run(
      () =>
        postJson<OfficeQuote>(`/api/quotes/${quote.id}/turn-down`, {
          reason,
        }),
      "Quote turned down",
    );
    if (ok) close();
  };

  return (
    <Dialog title="Turn down this quote?" role="alertdialog" {...state}>
      {({ close }) => (
        <>
          <p>
            {quote.client.email
              ? `${quote.client.name} is emailed to say we can't take it on, and why. They can ask again later.`
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
            <Button variant="quiet" onPress={close}>
              Keep it
            </Button>
            <Button
              variant="danger"
              isPending={action.isPending}
              onPress={() => void turnDown(close)}
            >
              Turn down
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}

/**
 * A price beside the form that's working it out (#434), the Draft's and New
 * quote's: what's said over it, its total, large, what's said under it,
 * then how it's worked out, folded: the Suggested Price's hours and money,
 * then `children`, what that price adds (the hours on site, a plan's
 * discount, which prices). `live` reads all but the working out as it
 * changes, so the total is heard with what it's for
 */
export function FoldedPrice({
  price,
  working,
  perClean,
  live,
  over,
  under,
  children,
}: {
  // what it comes to, which may be a price of the Office's own
  price: { totalCents: number; taxCents: number };
  // the Suggested Price it starts from
  working: PriceBreakdown;
  perClean?: boolean;
  live?: boolean;
  over?: ReactNode;
  under?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <div
        aria-live={live ? "polite" : undefined}
        className="flex flex-col gap-1"
      >
        {over}
        <PriceHead
          totalCents={price.totalCents}
          taxCents={price.taxCents}
          perClean={perClean}
        />
        {under}
      </div>
      <Fold label="How it's worked out">
        <div className="flex flex-col gap-3">
          <PriceWorking breakdown={working} />
          {children}
        </div>
      </Fold>
    </>
  );
}

// The Suggested Price for the Quote's Service (after the one recommended for
// a first visit, where that's offered too) and how each was worked out,
// how a Suggested Price is worked out, from the home's or premises' hours
export function PriceWorking({ breakdown: b }: { breakdown: PriceBreakdown }) {
  const homeHours = b.homeHours.reduce((sum, part) => sum + part.hours, 0);
  // breakdowns from before #72 have no kind: they're all homes
  const premises = b.propertyKind === "commercial";
  return (
    <Figures>
      {b.homeHours.map((part) => (
        <Figure
          key={part.label}
          label={part.label}
          value={formatHours(part.hours)}
        />
      ))}
      <Figure
        label={premises ? "The business" : "The home"}
        value={formatHours(homeHours)}
        strong
      />
      <Figure label={working.condition(null, b.conditionMultiplier)} value="" />
      {/* saved before each Service had its own hours (ADR-0018) */}
      {b.cleanTypeMultiplier !== undefined && !premises && (
        <Figure
          label={`× ${b.serviceName} (${b.cleanTypeMultiplier})`}
          value=""
        />
      )}
      {b.addOns.map((addOn) => (
        <Figure
          key={addOn.key}
          label={working.addOn(addOn)}
          value={formatHours(addOn.hours)}
        />
      ))}
      <Figure label={working.hours} value={formatHours(b.labourHours)} strong />
      <Figure
        label={working.rate(b.hourlyRateCents, premises)}
        value={formatMoney(b.workedOutCents)}
      />
      {b.minimumApplied && (
        <Figure
          label={working.minimum(b.minimumChargeCents)}
          value={formatMoney(b.minimumChargeCents)}
        />
      )}
      <Figure
        label="Suggested price, before tax"
        value={formatMoney(b.priceCents)}
        strong
      />
    </Figures>
  );
}
