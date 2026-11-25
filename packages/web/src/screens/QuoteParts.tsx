import type { ReactNode } from "react";
import type {
  PlanChange,
  PlanDayTerms,
  QuoteAddOn,
  QuoteAsked,
  QuoteOption,
  QuoteStatus,
  ServicePlanTerms,
} from "@empire-cleaning/models";
import {
  Card,
  Fact,
  Figure,
  Figures,
  StatusBadge,
  useLanguage,
} from "@empire-cleaning/ui";
import { Building2, CirclePlus, NotebookPen, Repeat } from "lucide-react";
import { catalog, type Language, messages } from "@empire-cleaning/models";
import {
  formatHours,
  quoteStatusLabel,
  quoteStatusTone,
  typedHours,
} from "./format.ts";
import { useSaid } from "./words.ts";

// in the screen's language: the Office's English, the portal's its
// Client's (ADR-0025)
const words = catalog({
  en: {
    cleaningWanted: "Cleaning wanted",
    regularVisits: "Regular visits",
    wantedAfter: "Wanted after the first clean",
    notAsked: "Not asked for",
    notes: "Notes",
    cleaningHours: "Cleaning hours",
    quoteRequested: "Quote requested",
    beingUpdated: "Being updated",
    includesTax: (tax: string) => `Includes ${tax} tax`,
    deposit: (percent: number) => `Deposit (${percent}%)`,
    save: (amount: string) => `Save ${amount} a clean`,
    aClean: " a clean",
    asOneOff: "As a one-off clean",
    planDiscount: (percent: number) => `Plan discount (${percent}%)`,
    onThePlan: "On the plan",
    aWeek: "A week's cleans",
    depositCarried: "Deposit, carried over from the plan",
    depositHeld: (percent: number, eachDay: boolean) =>
      `Deposit (${percent}%${eachDay ? " of a week's cleans" : ""}), held while the plan runs`,
  },
  es: {
    cleaningWanted: "Limpieza que quiere",
    regularVisits: "Visitas regulares",
    wantedAfter: "Las quiere después de la primera limpieza",
    notAsked: "No las pidió",
    notes: "Notas",
    cleaningHours: "Horas de limpieza",
    quoteRequested: "Cotización solicitada",
    beingUpdated: "Se está actualizando",
    includesTax: (tax: string) => `Incluye ${tax} de impuestos`,
    deposit: (percent: number) => `Depósito (${percent}%)`,
    save: (amount: string) => `Ahorre ${amount} por limpieza`,
    aClean: " por limpieza",
    asOneOff: "Como una sola limpieza",
    planDiscount: (percent: number) => `Descuento del plan (${percent}%)`,
    onThePlan: "Con el plan",
    aWeek: "Las limpiezas de una semana",
    depositCarried: "Depósito, traspasado del plan",
    depositHeld: (percent: number, eachDay: boolean) =>
      `Depósito (${percent}%${eachDay ? " de las limpiezas de una semana" : ""}), retenido mientras dure el plan`,
  },
});

const useWords = () => useSaid(words);

// how a Quote reads, the same for the Office and its Client: prices include
// tax, as Clients always see them

// the end of what was asked, as Facts after the reader's own: the cleaning
// a business wants, or a home's extras and regular visits, then any notes
export function AskedRows({
  asked,
  premises,
}: {
  asked: QuoteAsked;
  premises: boolean;
}) {
  const { w, wantedCleaning, extras, none } = useWords();
  return (
    <>
      {premises ? (
        <Fact
          icon={Building2}
          label={w.cleaningWanted}
          value={wantedCleaning(asked)}
        />
      ) : (
        <>
          <Fact
            icon={CirclePlus}
            label={extras}
            value={
              asked.addOns.length > 0
                ? asked.addOns.map((a) => a.name).join(", ")
                : none
            }
          />
          <Fact
            icon={Repeat}
            label={w.regularVisits}
            value={asked.wantsRegularService ? w.wantedAfter : w.notAsked}
          />
        </>
      )}
      {asked.notes && (
        <Fact
          icon={NotebookPen}
          label={w.notes}
          value={<span className="whitespace-pre-line">{asked.notes}</span>}
          className="col-span-full"
        />
      )}
    </>
  );
}

// an option's hours, as Figures: its cleaning hours, and how long its crew
// is there; for a crew of one those are one fact, so its time there alone; the Office's, as the Client reads one how long on the Quote's
// facts
export function HoursRows({
  option,
  crewSize,
}: {
  option: QuoteOption;
  crewSize: number;
}) {
  const { w, cleaners, onSiteWith } = useWords();
  return (
    <>
      {/* hours priced at a rate, as its working-out says them: "3.25 h" */}
      {crewSize > 1 && (
        <Figure
          label={w.cleaningHours}
          value={typedHours(option.labourHours)}
        />
      )}
      <Figure
        label={onSiteWith(cleaners(crewSize))}
        value={formatHours(option.hoursOnSite)}
      />
    </>
  );
}

// the toast once a Quote is asked for, by the Client or someone signing up
export const quoteRequested = (lang: Language, emailedTo: string) => ({
  tone: "success" as const,
  title: words[lang].quoteRequested,
  description: messages[lang].quoteEmailedTo(emailedTo),
});

// a Sent or Expired Quote with a Revision being drafted
export function DraftChangesBadge() {
  return <StatusBadge tone="info">{useWords().w.beingUpdated}</StatusBadge>;
}

// a Quote's state as its Client reads it: QuoteStatusBadge's, in their words
export function ClientQuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { tone, label } = useWords().clientQuoteStatus[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <StatusBadge tone={quoteStatusTone[status]}>
      {quoteStatusLabel[status]}
    </StatusBadge>
  );
}

// a price in large type, with the tax it includes under it; a plan's
// clean's says it's for a clean
export function PriceHead({
  totalCents,
  taxCents,
  perClean = false,
}: {
  totalCents: number;
  taxCents: number;
  perClean?: boolean;
}) {
  const { w, formatMoney } = useWords();
  return (
    <span className="flex flex-col gap-1">
      <span className="font-display text-4xl font-bold tracking-wide">
        {formatMoney(totalCents)}
        {perClean && (
          <span className="text-base font-normal text-fg-muted">
            {w.aClean}
          </span>
        )}
      </span>
      <span className="text-sm text-fg-muted">
        {w.includesTax(formatMoney(taxCents))}
      </span>
    </span>
  );
}

// a one-off clean's price, its hours and its Deposit
export function OptionFigures({
  option,
  crewSize,
  depositPercent,
}: {
  option: QuoteOption;
  crewSize: number;
  depositPercent: number;
}) {
  return (
    <>
      <PriceHead totalCents={option.totalCents} taxCents={option.taxCents} />
      <OptionRows
        option={option}
        crewSize={crewSize}
        depositPercent={depositPercent}
      />
    </>
  );
}

// a one-off clean's hours and Deposit, under its price
export function OptionRows({
  option,
  crewSize,
  depositPercent,
}: {
  option: QuoteOption;
  crewSize: number;
  depositPercent: number;
}) {
  const { w, formatMoney } = useWords();
  return (
    <Figures>
      <HoursRows option={option} crewSize={crewSize} />
      <Figure
        label={w.deposit(depositPercent)}
        value={formatMoney(option.depositCents)}
      />
    </Figures>
  );
}

// One weekday of a Service Plan Quote: when, its clean's price, and the
// saving against the same clean as a one-off Job
export function PlanDayCard({
  option,
  day,
  discountPercent,
}: {
  option: QuoteOption;
  day: PlanDayTerms;
  discountPercent: number;
}) {
  return (
    <Card
      title={planDayTitle(useLanguage(), day)}
      headingLevel={3}
      description={<PlanSaving day={day} discountPercent={discountPercent} />}
    >
      <PlanFigures
        option={option}
        day={day}
        discountPercent={discountPercent}
      />
    </Card>
  );
}

// "Mondays at 9:00 AM: Standard Clean", or a Draft's weekday with no time
// yet, "Standard Clean"
export const planDayTitle = (lang: Language, day: PlanDayTerms) =>
  day.startsAt
    ? `${messages[lang].planDayWhen(day.startsAt)}: ${day.serviceName}`
    : day.serviceName;

// what a plan clean saves, said only when the plan has a discount: a plan
// can be quoted at none
export function PlanSaving({
  day,
  discountPercent,
}: {
  day: PlanDayTerms;
  discountPercent: number;
}) {
  const { w, formatMoney } = useWords();
  if (discountPercent <= 0) return null;
  return (
    <StatusBadge tone="success">
      {w.save(formatMoney(day.savingCents))}
    </StatusBadge>
  );
}

// a plan clean's price, against the same clean as a one-off Job
export function PlanFigures({
  option,
  day,
  discountPercent,
  children,
}: {
  option: QuoteOption;
  day: PlanDayTerms;
  discountPercent: number;
  // more rows for its list, e.g. the Office's hours
  children?: ReactNode;
}) {
  return (
    <>
      <PriceHead
        totalCents={option.totalCents}
        taxCents={option.taxCents}
        perClean
      />
      <PlanRows option={option} day={day} discountPercent={discountPercent}>
        {children}
      </PlanRows>
    </>
  );
}

// a plan clean against the same clean as a one-off Job, under its price
export function PlanRows({
  option,
  day,
  discountPercent,
  children,
}: {
  option: QuoteOption;
  day: PlanDayTerms;
  discountPercent: number;
  // more rows for its list, e.g. the Office's hours
  children?: ReactNode;
}) {
  const { w, formatMoney } = useWords();
  return (
    <Figures>
      <Figure label={w.asOneOff} value={formatMoney(day.oneOffTotalCents)} />
      {discountPercent > 0 && (
        <Figure
          label={w.planDiscount(discountPercent)}
          value={`−${formatMoney(day.savingCents)}`}
        />
      )}
      <Figure
        label={w.onThePlan}
        value={formatMoney(option.totalCents)}
        strong
      />
      {children}
    </Figures>
  );
}

// A Service Plan Quote as a whole: what a week of cleans costs, on several
// weekdays, and its Deposit, for one clean on each, or the plan's own when
// it changes the home's plan
export function PlanTotals({
  plan,
  depositPercent,
  change,
}: {
  plan: ServicePlanTerms;
  depositPercent: number;
  change?: PlanChange | null;
}) {
  const { w, formatMoney } = useWords();
  return (
    <Figures size="md">
      {plan.days.length > 1 && (
        <Figure
          label={w.aWeek}
          value={formatMoney(plan.roundTotalCents)}
          strong
        />
      )}
      <Figure
        label={
          change
            ? w.depositCarried
            : w.depositHeld(depositPercent, plan.days.length > 1)
        }
        value={formatMoney(change ? change.depositCents : plan.depositCents)}
      />
    </Figures>
  );
}

// what each Add-on adds to an option's price, tax included; nothing for an
// option with none
export function AddOnList({ addOns }: { addOns: QuoteAddOn[] }) {
  const { formatMoney } = useWords();
  if (addOns.length === 0) return null;
  return (
    <Figures>
      {addOns.map((addOn) => (
        <Figure
          key={addOn.key}
          label={addOn.name}
          value={`+${formatMoney(addOn.totalCents)}`}
        />
      ))}
    </Figures>
  );
}
