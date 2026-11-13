import { useState } from "react";
import {
  FilePenLine,
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
import { needsVisit, formats } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Link,
  Notice,
  Radio,
  RadioGroup,
  Facts,
  Fact,
  type Alert,
  type DialogState,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { BookSiteVisit } from "./SiteVisitParts.tsx";
import { useStartDraft } from "./StartDraft.tsx";
import { addressOf, formatHours, roomsText, screenWords } from "../format.ts";
import { homeIcon } from "../icons.ts";
import { AskedRows } from "../QuoteParts.tsx";
import { working } from "./WorkedOutQuote.tsx";

const { conditionLabel, conditionText, formatFloorArea, propertySummary } =
  screenWords.en;

const { formatDate, formatMoney } = formats.en;

// The parts of a Quote's page about what was asked and getting to its first
// Revision: the ask itself, its Site Visit, the Suggested Price, drafting,
// and Turning it Down (ADR-0017)

export const propertyLink = (quote: OfficeQuote) =>
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

// A Requested Quote's way on: drafting its first Revision, which sets its
// kind. Where either kind is possible (the home's First Clean is Completed,
// or for business premises at any time, ADR-0014), it asks which first
export function DraftQuote({ quote }: { quote: OfficeQuote }) {
  const { start, starting } = useStartDraft();
  const eitherKind =
    quote.firstCleanCompleted || quote.property.kind === "commercial";
  const draft = (kind: QuoteKind) => void start({ quoteId: quote.id, kind });
  const label = (
    <>
      <FilePenLine aria-hidden size={16} />
      Draft the quote
    </>
  );

  return (
    <>
      {eitherKind ? (
        <DialogTrigger>
          <Button variant="text" size="sm">
            {label}
          </Button>
          <Dialog title="Which kind of quote?">
            <p>
              A one-off clean, or a cleaning plan of regular cleans at a
              discount.
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
        </DialogTrigger>
      ) : (
        <Button
          variant="text"
          size="sm"
          isPending={starting !== undefined}
          onPress={() => draft("one_off")}
        >
          {label}
        </Button>
      )}
    </>
  );
}

// A Service seen first is seen before it's quoted (ADR-0018), for a home
// too: the Office books a Site Visit, or records findings it knows already
// on the Property
export const seeThePremises = (quote: OfficeQuote): Alert => ({
  key: "see",
  tone: "warning",
  action: <BookSiteVisit quoteId={quote.id} />,
  children: (
    <p>
      <strong>{needsVisit(quote.property.kind)}</strong> Book one, or if you
      know it already, record what you know on the{" "}
      <Link href={propertyLink(quote)}>property page</Link>.
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

// The Suggested Price for the Quote's Service (after the one recommended for
// a first visit, where that's offered too) and how each was worked out,
// how a Suggested Price is worked out, from the home's or premises' hours
export function PriceWorking({ breakdown: b }: { breakdown: PriceBreakdown }) {
  const homeHours = b.homeHours.reduce((sum, part) => sum + part.hours, 0);
  // breakdowns from before #72 have no kind: they're all homes
  const premises = b.propertyKind === "commercial";
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      {b.homeHours.map((part) => (
        <Row
          key={part.label}
          label={part.label}
          value={formatHours(part.hours)}
        />
      ))}
      <Row
        label={premises ? "The business" : "The home"}
        value={formatHours(homeHours)}
        strong
      />
      <Row label={working.condition(null, b.conditionMultiplier)} value="" />
      {/* saved before each Service had its own hours (ADR-0018) */}
      {b.cleanTypeMultiplier !== undefined && !premises && (
        <Row label={`× ${b.serviceName} (${b.cleanTypeMultiplier})`} value="" />
      )}
      {b.addOns.map((addOn) => (
        <Row
          key={addOn.key}
          label={working.addOn(addOn)}
          value={formatHours(addOn.hours)}
        />
      ))}
      <Row label={working.hours} value={formatHours(b.labourHours)} strong />
      <Row
        label={working.rate(b.hourlyRateCents, premises)}
        value={formatMoney(b.workedOutCents)}
      />
      {b.minimumApplied && (
        <Row
          label={working.minimum(b.minimumChargeCents)}
          value={formatMoney(b.minimumChargeCents)}
        />
      )}
      <Row
        label="Suggested price, before tax"
        value={formatMoney(b.priceCents)}
        strong
      />
    </dl>
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
