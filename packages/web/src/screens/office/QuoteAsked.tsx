import { useState } from "react";
import { CircleX, FilePenLine } from "lucide-react";
import type {
  OfficeQuote,
  PriceBreakdown,
  QuoteKind,
  TurnDownReason,
} from "@empire-cleaning/models";
import {
  Actions,
  Button,
  Dialog,
  DialogTrigger,
  Link,
  Notice,
  Radio,
  RadioGroup,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { BookSiteVisit } from "./SiteVisitParts.tsx";
import { useStartDraft } from "./StartDraft.tsx";
import {
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

export const propertyLink = (quote: OfficeQuote) =>
  linkTo({
    to: "/office/properties/$propertyId",
    params: { propertyId: quote.property.id },
  });

// what the Client (or a caller) asked for, unchanged; none on a Quote the
// Office offered unprompted
export function AskedFacts({ quote }: { quote: OfficeQuote }) {
  const { asked, property } = quote;
  if (!asked) return null;
  const stated = asked.condition;
  // a business states none: a Site Visit finds it
  const corrected = stated !== null && stated !== property.condition;
  const premises = property.kind === "commercial";

  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
      <dt className="font-semibold">Asked</dt>
      <dd>
        {formatDate(quote.createdAt)}
        {quote.origin === "caller" && ", by phone"}
      </dd>
      <dt className="font-semibold">Service</dt>
      <dd>{asked.service.name}</dd>
      {asked.area !== null && (
        <>
          <dt className="font-semibold">Area</dt>
          <dd>About {asked.area.toLocaleString("en-US")} sq ft</dd>
        </>
      )}
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
  );
}

// A Requested Quote's way on: drafting its first Revision, which sets its
// kind. Where either kind is possible (the home's First Clean is Completed,
// or for business premises at any time, ADR-0014), it asks which first
export function DraftQuote({ quote }: { quote: OfficeQuote }) {
  const { start, starting, failure } = useStartDraft();
  const eitherKind =
    quote.firstCleanCompleted || quote.property.kind === "commercial";
  const draft = (kind: QuoteKind) => void start({ quoteId: quote.id, kind });
  const label = (
    <>
      <FilePenLine aria-hidden size={16} />
      Draft the Quote
    </>
  );

  return (
    <>
      {eitherKind ? (
        <DialogTrigger>
          <Button variant="text" size="sm">
            {label}
          </Button>
          <Dialog title="Which kind of Quote?">
            <p>
              A one-off clean, or a Service Plan of regular cleans at a
              discount.
            </p>
            {failure && <Notice tone="danger">{failure}</Notice>}
            <Actions>
              <Button
                variant="secondary"
                isPending={starting?.kind === "one_off"}
                isDisabled={starting !== undefined}
                onPress={() => draft("one_off")}
              >
                A one-off Quote
              </Button>
              <Button
                isPending={starting?.kind === "service_plan"}
                isDisabled={starting !== undefined}
                onPress={() => draft("service_plan")}
              >
                A Service Plan Quote
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
      {failure && !eitherKind && (
        <p role="alert" className="pt-1 text-sm text-danger-strong">
          {failure}
        </p>
      )}
    </>
  );
}

// Business premises are seen before they're quoted (ADR-0014): the Office
// books a Site Visit, or records findings it knows already on the Property
export function SeeThePremises({ quote }: { quote: OfficeQuote }) {
  return (
    <Notice action={<BookSiteVisit quoteId={quote.id} />}>
      <p>
        <strong>Business premises are seen before they're quoted.</strong> Book
        a Site Visit, or if you know the premises already, record what you know
        on the{" "}
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
        label={premises ? "The premises" : "The home"}
        value={formatHours(homeHours)}
        strong
      />
      <Row label={`× Condition (${b.conditionMultiplier})`} value="" />
      {/* saved before each Service had its own hours (ADR-0018) */}
      {b.cleanTypeMultiplier !== undefined && !premises && (
        <Row label={`× ${b.serviceName} (${b.cleanTypeMultiplier})`} value="" />
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
      {b.minimumApplied && (
        <Row
          label="Below the Minimum Charge, so that applies"
          value={formatMoney(b.minimumChargeCents)}
        />
      )}
      <Row
        label="Suggested Price, before tax"
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
