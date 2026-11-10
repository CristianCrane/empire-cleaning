import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import {
  CalendarClock,
  CreditCard,
  FileText,
  MapPin,
  Users,
} from "lucide-react";
import type {
  AcceptOutcome,
  AskedQuoteView,
  ClientQuoteView,
  PaymentMethodView,
  PlanChange,
  QuoteOption,
  QuoteView,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Section,
  Dialog,
  DialogTrigger,
  Heading,
  IconTile,
  Link,
  Notice,
  RadioCard,
  RadioGroup,
  StatusBadge,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { addressOf, formatHours, formatMinutes } from "../format.ts";
import { type Said, useSaid } from "../words.ts";
import { Fact } from "../Fact.tsx";
import {
  AskedRows,
  PlanDayCard,
  PlanTotals,
  ClientQuoteStatusBadge,
} from "../QuoteParts.tsx";
import { ConsentNote, usePaymentForm } from "./CardForm.tsx";
import { catalog } from "@empire-cleaning/models";
import { requestQuoteHref } from "./whats-next.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    updated: (day: string) => ` · Updated ${day}`,
    openUntil: (when: string) => ` · Open until ${when}`,
    comeToSee: (
      premises: boolean,
      visitor: string,
      when: string,
      length: string,
    ) =>
      `We'll come to see ${premises ? "the business" : "your home"} first, for free: ${visitor} visits on ${when}, for about ${length}. We email your quote after the visit. To change the time, please call us.`,
    askedFor: "What you asked for",
    asked: "Asked",
    condition: "Condition",
    yourKind: (kind: string) => `Your ${kind.toLowerCase()}`,
    bookedUp: (planDays: boolean, when: string) =>
      `Sorry, ${planDays ? "one of the days your plan starts on has" : `${when} has`} been fully booked since we sent this quote, so it can't be accepted. We've let our team know, and we'll send you a new quote for another time.`,
    details: "Quote details",
    aWeekTax: "A week, with a clean on each day, tax included",
    aCleanTax: (service: string) => `${service}, a clean, tax included`,
    taxIncluded: (service: string) => `${service}, tax included`,
    when: "When",
    from: (when: string) => `From ${when}`,
    yourClean: "Your clean",
    where: "Where",
    onSite: "On site",
    crewAbout: (cleaners: string, hours: string) =>
      `${cleaners}, about ${hours}`,
    recommend: (recommended: string, own: string) =>
      `We recommend a ${recommended} for a first visit: it brings your home up to standard. A ${own} costs less.`,
    recommended: "Recommended",
    hoursDeposit: (hours: string, deposit: string) =>
      `${hours} of cleaning · ${deposit} deposit`,
    noLongerFits:
      "No longer fits on that day: it's been booked up since we sent this quote",
    oneADay: "One clean a day. ",
    eachOff: (percent: number) =>
      `Each clean is ${percent}% off what it would cost as a one-off.`,
    onEvery: (extras: string) => `On every clean, included: ${extras}`,
    includes: (extras: string) => `Includes ${extras}`,
    tax: "Tax",
    total: "Total",
    deposit: (percent: number, paid: boolean) =>
      `Deposit (${percent}%)${paid ? ", paid" : ""}`,
    restOnBill: "The rest, on that week's bill",
    restWhenDone: "The rest, when the clean is done",
    planChanged: (when: string) =>
      `Your cleaning plan has changed: it's on these terms from ${when}.`,
    planStarted: (when: string) =>
      `Your cleaning plan has started: its first clean is on ${when}.`,
    acceptedOn: (when: string) => `You accepted this quote on ${when}.`,
    booked: (service: string, when: string) =>
      `You're booked: a ${service} on ${when}.`,
    declinedOn: (when: string) => `You declined this quote on ${when}.`,
    expiredOn: (when: string) => `This quote expired on ${when}.`,
    changesPlan: "This changes your cleaning plan",
    movesTerms: (when: string) =>
      `From ${when}, your plan moves to the terms below. Cleans before then go ahead as they are.`,
    replaces: (n: number) =>
      n === 1
        ? "The clean you have booked from then on is cancelled, at no charge:"
        : "The cleans you have booked from then on are cancelled, at no charge:",
    depositStays: (amount: string) =>
      `Your ${amount} deposit stays as it is, so nothing is charged now.`,
    planStartedToast: "Your cleaning plan has started",
    bookedToast: "You're booked",
    payAndStart: "Pay and start your plan",
    startPlan: "Start your plan",
    book: "Book",
    useYour: (card: string) => `Use your ${card}`,
    payingWith: (card: string) => `Paying with your ${card}`,
    savedCard: "saved card",
    takeAndKeep: (amount: string) =>
      `We take the ${amount} deposit now and keep it for as long as your plan runs. It comes off your last clean when the plan ends. `,
    firstOn: (when: string) => ` The first is on ${when}.`,
    bookedFor: (when: string) => ` Booked for ${when}.`,
    acceptPay: (amount: string) => `Accept and pay ${amount}`,
    acceptBook: "Accept and book",
    takeRestBilled: (deposit: string, rest: string, billed: string) =>
      `We take the ${deposit} deposit now, and the rest, ${rest}, ${billed}.`,
    takeRestDone: (deposit: string, rest: string) =>
      `We take the ${deposit} deposit now and the rest, ${rest}, when the clean is done.`,
    nothingNow: (total: string, how: string) =>
      `Nothing is taken now. The ${total} ${how}.`,
    chargedWhenDone: "is charged when the clean is done",
    eachIs: (price: string) => `Each clean is ${price}. `,
    eachCharged: (price: string | null) =>
      `${price ? `Each clean, ${price},` : "Each clean"} is charged when it's done.`,
    planChangedToast: "Your cleaning plan has changed",
    acceptNew: "Accept the new terms",
    nothingCharged: "Nothing is charged now.",
    newStart: (when: string) => ` The new terms start on ${when}.`,
    declined: "Quote declined",
    decline: "Decline this quote",
    declineQ: "Decline this quote?",
    thanks:
      "Thanks for letting us know. You can ask us for a new quote whenever you like.",
    keep: "Keep it",
    declineButton: "Decline",
  },
  es: {
    updated: (day: string) => ` · Actualizada el ${day}`,
    openUntil: (when: string) => ` · Abierta hasta el ${when}`,
    comeToSee: (
      premises: boolean,
      visitor: string,
      when: string,
      length: string,
    ) =>
      `Primero iremos a ver ${premises ? "el negocio" : "su casa"}, sin costo: ${visitor} lo visita el ${when}, durante unos ${length}. Le enviamos la cotización por correo después de la visita. Para cambiar la hora, por favor llámenos.`,
    askedFor: "Lo que pidió",
    asked: "Pedida",
    condition: "Estado",
    yourKind: (kind: string) => `Su ${kind.toLowerCase()}`,
    bookedUp: (planDays: boolean, when: string) =>
      `Lo sentimos, ${planDays ? "uno de los días en que empieza su plan se llenó" : `el ${when} se llenó`} después de que le enviamos esta cotización, así que no se puede aceptar. Ya le avisamos a nuestro equipo, y le enviaremos una nueva cotización para otra hora.`,
    details: "Detalles de la cotización",
    aWeekTax: "Una semana, con una limpieza cada día, impuestos incluidos",
    aCleanTax: (service: string) =>
      `${service}, por limpieza, impuestos incluidos`,
    taxIncluded: (service: string) => `${service}, impuestos incluidos`,
    when: "Cuándo",
    from: (when: string) => `Desde el ${when}`,
    yourClean: "Su limpieza",
    where: "Dónde",
    onSite: "En el lugar",
    crewAbout: (cleaners: string, hours: string) =>
      `${cleaners}, unas ${hours}`,
    recommend: (recommended: string, own: string) =>
      `Le recomendamos una ${recommended} para la primera visita: deja su casa en buen estado. Una ${own} cuesta menos.`,
    recommended: "Recomendada",
    hoursDeposit: (hours: string, deposit: string) =>
      `${hours} de limpieza · ${deposit} de depósito`,
    noLongerFits:
      "Ya no cabe ese día: se llenó después de que le enviamos esta cotización",
    oneADay: "Una limpieza por día. ",
    eachOff: (percent: number) =>
      `Cada limpieza cuesta un ${percent}% menos que como una sola limpieza.`,
    onEvery: (extras: string) => `En cada limpieza, incluido: ${extras}`,
    includes: (extras: string) => `Incluye ${extras}`,
    tax: "Impuestos",
    total: "Total",
    deposit: (percent: number, paid: boolean) =>
      `Depósito (${percent}%)${paid ? ", pagado" : ""}`,
    restOnBill: "El resto, en la factura de esa semana",
    restWhenDone: "El resto, cuando la limpieza esté terminada",
    planChanged: (when: string) =>
      `Su plan de limpieza cambió: tiene estas condiciones desde el ${when}.`,
    planStarted: (when: string) =>
      `Su plan de limpieza empezó: su primera limpieza es el ${when}.`,
    acceptedOn: (when: string) => `Aceptó esta cotización el ${when}.`,
    booked: (service: string, when: string) =>
      `Está reservado: ${service} el ${when}.`,
    declinedOn: (when: string) => `Rechazó esta cotización el ${when}.`,
    expiredOn: (when: string) => `Esta cotización venció el ${when}.`,
    changesPlan: "Esto cambia su plan de limpieza",
    movesTerms: (when: string) =>
      `Desde el ${when}, su plan pasa a las condiciones de abajo. Las limpiezas de antes siguen como están.`,
    replaces: (n: number) =>
      n === 1
        ? "La limpieza que tiene reservada desde entonces se cancela, sin cargo:"
        : "Las limpiezas que tiene reservadas desde entonces se cancelan, sin cargo:",
    depositStays: (amount: string) =>
      `Su depósito de ${amount} se mantiene, así que no se cobra nada ahora.`,
    planStartedToast: "Su plan de limpieza empezó",
    bookedToast: "Está reservado",
    payAndStart: "Pagar y empezar su plan",
    startPlan: "Empezar su plan",
    book: "Reservar",
    useYour: (card: string) => `Usar su ${card}`,
    payingWith: (card: string) => `Paga con su ${card}`,
    savedCard: "tarjeta guardada",
    takeAndKeep: (amount: string) =>
      `Cobramos ahora el depósito de ${amount} y lo guardamos mientras dure su plan. Se descuenta de su última limpieza cuando el plan termine. `,
    firstOn: (when: string) => ` La primera es el ${when}.`,
    bookedFor: (when: string) => ` Reservada para el ${when}.`,
    acceptPay: (amount: string) => `Aceptar y pagar ${amount}`,
    acceptBook: "Aceptar y reservar",
    takeRestBilled: (deposit: string, rest: string, billed: string) =>
      `Cobramos ahora el depósito de ${deposit}, y el resto, ${rest}, ${billed}.`,
    takeRestDone: (deposit: string, rest: string) =>
      `Cobramos ahora el depósito de ${deposit} y el resto, ${rest}, cuando la limpieza esté terminada.`,
    nothingNow: (total: string, how: string) =>
      `No se cobra nada ahora. El total de ${total} ${how}.`,
    chargedWhenDone: "se cobra cuando la limpieza esté terminada",
    eachIs: (price: string) => `Cada limpieza cuesta ${price}. `,
    eachCharged: (price: string | null) =>
      `${price ? `Cada limpieza, de ${price},` : "Cada limpieza"} se cobra cuando esté terminada.`,
    planChangedToast: "Su plan de limpieza cambió",
    acceptNew: "Aceptar las nuevas condiciones",
    nothingCharged: "No se cobra nada ahora.",
    newStart: (when: string) => ` Las nuevas condiciones empiezan el ${when}.`,
    declined: "Cotización rechazada",
    decline: "Rechazar esta cotización",
    declineQ: "¿Rechazar esta cotización?",
    thanks:
      "Gracias por avisarnos. Puede pedirnos una nueva cotización cuando quiera.",
    keep: "Conservarla",
    declineButton: "Rechazar",
  },
});

// A Quote as its Client sees it, from the link in every Quote email (ADR-0017):
// only its offer, the latest Sent Revision, which they accept right here; or,
// with nothing Sent yet, what they asked for
export function PortalQuote() {
  const { quote, paymentMethod } = useLoaderData({
    from: "/portal/quotes/$quoteId",
  });

  return quote.sentAt === null ? (
    <AskedQuote quote={quote} />
  ) : (
    <OfferedQuote quote={quote} paymentMethod={paymentMethod} />
  );
}

function QuoteHeader({
  quote,
  title,
  updatedAt = null,
  openUntil = null,
}: {
  quote: ClientQuoteView;
  title: string;
  updatedAt?: string | null;
  // while an offer is open
  openUntil?: string | null;
}) {
  const t = useSaid(words);
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: t.p.home, href: linkTo({ to: "/portal" }) },
          { label: t.p.yourQuote },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>{title}</Heading>
        <ClientQuoteStatusBadge status={quote.status} />
      </div>
      <p className="text-fg-muted">
        {addressOf(quote.property)}
        {/* a resend replaced the offer they may have seen before */}
        {updatedAt && t.w.updated(t.formatDate(updatedAt))}
        {openUntil && t.w.openUntil(t.formatDateTime(openUntil))}
      </p>
    </div>
  );
}

// what they asked for, while the Office prepares the Quote, or once it's
// Turned Down
function AskedQuote({ quote }: { quote: AskedQuoteView }) {
  const t = useSaid(words);
  const { asked, siteVisit } = quote;
  // a business states no Condition: a Site Visit finds it
  const premises = asked.condition === null;

  return (
    <div className="flex flex-col gap-6">
      <QuoteHeader quote={quote} title={t.p.yourQuote} />

      {quote.status === "turned_down" ? (
        <Notice>
          <p>
            {t.turnedDown(quote.turnDownReason!)} {t.ASK_AGAIN}
          </p>
          <p>
            <Link href={requestQuoteHref}>{t.REQUEST_A_QUOTE}</Link>
          </p>
        </Notice>
      ) : siteVisit ? (
        <Notice tone="info">
          {t.w.comeToSee(
            premises,
            siteVisit.visitorName,
            t.formatDateTime(siteVisit.startsAt),
            formatMinutes(siteVisit.minutes),
          )}
        </Notice>
      ) : (
        <Notice tone="info">{t.WORKING_ON_IT}</Notice>
      )}

      <Section title={t.w.askedFor}>
        <Card>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">{t.w.asked}</dt>
            <dd>{t.formatDate(quote.createdAt)}</dd>
            {!premises && (
              <>
                <dt className="font-semibold">{t.w.condition}</dt>
                <dd>{t.conditionLabel[asked.condition!]}</dd>
              </>
            )}
            <AskedRows asked={asked} premises={premises} />
          </dl>
        </Card>
      </Section>
    </div>
  );
}

// the offer, read like a Quote, then paying and booking under it while
// it's open (#96)
function OfferedQuote({
  quote,
  paymentMethod,
}: {
  quote: QuoteView;
  paymentMethod: PaymentMethodView | null;
}) {
  const t = useSaid(words);
  // the clean chosen: the one accepted, or the recommended one, unless
  // only the other still fits
  const [serviceKey, setServiceKey] = useState(
    quote.acceptedServiceKey ??
      (
        quote.options.find((o) => quote.bookable.includes(o.serviceKey)) ??
        quote.options[0]!
      ).serviceKey,
  );
  const chosen =
    quote.options.find((o) => o.serviceKey === serviceKey) ?? quote.options[0]!;

  return (
    <div className="flex flex-col gap-6">
      <QuoteHeader
        quote={quote}
        title={t.w.yourKind(t.quoteKindName(quote.kind))}
        updatedAt={quote.updatedAt}
        openUntil={quote.status === "sent" ? quote.expiresAt : null}
      />

      <Standing quote={quote} chosen={chosen} />
      {quote.changesPlan && quote.status === "sent" && (
        <PlanChangeNotice quote={quote} change={quote.changesPlan} />
      )}

      <QuoteDetails quote={quote} chosen={chosen} onChoose={setServiceKey} />

      {quote.status === "sent" &&
        (quote.bookable.length === 0 ? (
          // its day filled up after it was sent: nothing to pay for
          <>
            <Notice tone="info">
              {t.w.bookedUp(
                Boolean(quote.plan && quote.plan.days.length > 1),
                t.formatDateTime(quote.proposedStartsAt),
              )}
            </Notice>
            <Actions>
              <Decline quote={quote} />
            </Actions>
          </>
        ) : quote.changesPlan ? (
          <AcceptChange quote={quote} />
        ) : (
          <Accept quote={quote} chosen={chosen} paymentMethod={paymentMethod} />
        ))}
    </div>
  );
}

// The Quote itself, as one card: what it comes to, when, where and for how
// long, the clean to choose (or a plan's days), then the money line by line
function QuoteDetails({
  quote,
  chosen,
  onChoose,
}: {
  quote: QuoteView;
  chosen: QuoteOption;
  onChoose: (serviceKey: string) => void;
}) {
  const t = useSaid(words);
  const { plan } = quote;
  const choosing = !plan && quote.options.length > 1 && quote.status === "sent";
  const [recommended, own] = quote.options;
  const extras = chosen.addOns.map((a) => a.name).join(", ");

  return (
    <Section title={t.w.details}>
      <Card>
        <div className="flex flex-col gap-5">
          {/* what it comes to */}
          <div className="flex items-start gap-3">
            <IconTile icon={FileText} />
            <div className="flex min-w-0 flex-col">
              <span className="font-display text-4xl font-bold tracking-wide tabular-nums">
                {t.formatMoney(
                  plan && plan.days.length > 1
                    ? plan.roundTotalCents
                    : chosen.totalCents,
                )}
              </span>
              <span className="text-sm text-fg-muted">
                {plan
                  ? plan.days.length > 1
                    ? t.w.aWeekTax
                    : t.w.aCleanTax(chosen.serviceName)
                  : t.w.taxIncluded(chosen.serviceName)}
              </span>
            </div>
          </div>

          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-3">
              <Fact
                icon={CalendarClock}
                label={t.w.when}
                value={
                  plan
                    ? t.planRhythm(plan)
                    : t.formatDateTime(quote.proposedStartsAt)
                }
                line={
                  plan
                    ? t.w.from(t.formatDateTime(quote.proposedStartsAt))
                    : t.w.yourClean
                }
              />
              <Fact
                icon={MapPin}
                label={t.w.where}
                value={addressOf(quote.property)}
                line={t.p.yourHome}
              />
              <Fact
                icon={Users}
                label={t.w.onSite}
                value={t.w.crewAbout(
                  t.cleaners(quote.crewSize),
                  formatHours(chosen.hoursOnSite),
                )}
                line={t.w.onSite}
              />
            </dl>
          </div>

          {choosing && (
            <div className="border-t border-border pt-4">
              <RadioGroup
                label={t.w.yourClean}
                description={t.w.recommend(
                  recommended!.serviceName,
                  own!.serviceName,
                )}
                layout="cards"
                value={chosen.serviceKey}
                onChange={onChoose}
              >
                {quote.options.map((option) => (
                  <RadioCard
                    key={option.serviceKey}
                    value={option.serviceKey}
                    title={option.serviceName}
                    isDisabled={!quote.bookable.includes(option.serviceKey)}
                    badge={
                      option.recommended && (
                        <StatusBadge tone="success">
                          {t.w.recommended}
                        </StatusBadge>
                      )
                    }
                  >
                    <span className="font-display text-3xl font-bold tabular-nums">
                      {t.formatMoney(option.totalCents)}
                    </span>
                    <span className="text-sm text-fg-muted">
                      {quote.bookable.includes(option.serviceKey)
                        ? t.w.hoursDeposit(
                            formatHours(option.labourHours),
                            t.formatMoney(option.depositCents),
                          )
                        : t.w.noLongerFits}
                    </span>
                  </RadioCard>
                ))}
              </RadioGroup>
            </div>
          )}

          {plan && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-sm text-fg-muted">
                {plan.days.length > 1 ? t.w.oneADay : ""}
                {t.w.eachOff(plan.discountPercent)}
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                {plan.days.map((day, i) => (
                  <PlanDayCard
                    key={day.startsAt}
                    option={quote.options[i]!}
                    day={day}
                    discountPercent={plan.discountPercent}
                  />
                ))}
              </div>
            </div>
          )}

          {/* the money, line by line */}
          <div className="flex flex-col gap-1 border-t border-border pt-4">
            {plan ? (
              <>
                {extras && (
                  <p className="text-sm text-fg-muted">{t.w.onEvery(extras)}</p>
                )}
                <PlanTotals
                  plan={plan}
                  depositPercent={quote.depositPercent}
                  change={quote.changesPlan}
                />
              </>
            ) : (
              <dl className="flex flex-col gap-1 text-sm">
                <Line
                  label={chosen.serviceName}
                  value={t.formatMoney(chosen.priceCents)}
                />
                {extras && (
                  <p className="text-fg-muted">{t.w.includes(extras)}</p>
                )}
                <Line label={t.w.tax} value={t.formatMoney(chosen.taxCents)} />
                <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold text-fg">
                  <dt>{t.w.total}</dt>
                  <dd className="tabular-nums">
                    {t.formatMoney(chosen.totalCents)}
                  </dd>
                </div>
                {chosen.depositCents > 0 && (
                  <>
                    <Line
                      label={t.w.deposit(
                        quote.depositPercent,
                        quote.status === "accepted",
                      )}
                      value={t.formatMoney(chosen.depositCents)}
                      strong
                    />
                    <Line
                      label={
                        quote.weeklyBill ? t.w.restOnBill : t.w.restWhenDone
                      }
                      value={t.formatMoney(
                        chosen.totalCents - chosen.depositCents,
                      )}
                    />
                  </>
                )}
              </dl>
            )}
          </div>
        </div>
      </Card>
    </Section>
  );
}

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "font-semibold text-fg" : "text-fg-muted"}>
        {label}
      </dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

// how it ended, once it's closed; while it's open, its header says until
// when
function Standing({
  quote,
  chosen,
}: {
  quote: QuoteView;
  chosen: QuoteOption;
}) {
  const t = useSaid(words);
  const proposed = t.formatDateTime(quote.proposedStartsAt);
  switch (quote.status) {
    case "accepted":
      return quote.servicePlanId ? (
        <Notice tone="success">
          {quote.changedPlan
            ? t.w.planChanged(proposed)
            : t.w.planStarted(proposed)}{" "}
          {t.w.acceptedOn(t.formatDateTime(quote.acceptedAt!))}{" "}
          <Link
            href={linkTo({
              to: "/portal/plans/$planId",
              params: { planId: quote.servicePlanId },
            })}
          >
            {t.p.seeYourCleaningPlan}
          </Link>
        </Notice>
      ) : (
        <Notice tone="success">
          {t.w.booked(chosen.serviceName, proposed)}{" "}
          {t.w.acceptedOn(t.formatDateTime(quote.acceptedAt!))}
        </Notice>
      );
    case "declined":
      return (
        <Notice>{t.w.declinedOn(t.formatDateTime(quote.declinedAt!))}</Notice>
      );
    case "expired":
      return (
        <Notice>{t.w.expiredOn(t.formatDateTime(quote.expiresAt))}</Notice>
      );
    default:
      return null;
  }
}

// what accepting a Quote for a home with a plan does to that plan
function PlanChangeNotice({
  quote,
  change,
}: {
  quote: QuoteView;
  change: PlanChange;
}) {
  const t = useSaid(words);
  return (
    <Notice tone="info">
      <strong>{t.w.changesPlan}</strong>
      <p>{t.w.movesTerms(t.formatDateTime(quote.proposedStartsAt))}</p>
      {change.replaces.length > 0 && (
        <p>
          {t.w.replaces(change.replaces.length)}{" "}
          {change.replaces.map((at) => t.formatDateTime(at)).join("; ")}.
        </p>
      )}
      <p>{t.w.depositStays(t.formatMoney(change.depositCents))}</p>
    </Notice>
  );
}

// One step under the Quote: enter a card (or keep the saved one) and accept
// the clean chosen above. The Deposit is taken, saving a card entered now,
// and the Job booked, or none of it. If their bank wants them to approve the
// payment, that happens here too, then the booking is finished. A Service
// Plan Quote is accepted whole, with a clean on each of its weekdays, and
// starts the plan, whose Deposit is held for as long as it runs.
function Accept({
  quote,
  chosen,
  paymentMethod,
}: {
  quote: QuoteView;
  chosen: QuoteOption;
  paymentMethod: PaymentMethodView | null;
}) {
  const t = useSaid(words);
  const [newCard, setNewCard] = useState(!paymentMethod);
  // what's bookable may have changed since the page loaded
  const action = useAction(t.p.didntWork, {
    reloadOnFailure: true,
  });
  const balance = chosen.totalCents - chosen.depositCents;
  const depositCents = quote.plan?.depositCents ?? chosen.depositCents;
  const payment = usePaymentForm({
    amountCents: depositCents,
    showCard: newCard,
  });

  const accept = () =>
    action.run(
      async () => {
        const paymentToken = newCard ? await payment.token() : undefined;
        const outcome = await postJson<AcceptOutcome>(
          `/api/quotes/mine/${quote.id}/accept`,
          // a plan is accepted whole
          quote.plan
            ? { revisionId: quote.revisionId, paymentToken }
            : {
                revisionId: quote.revisionId,
                serviceKey: chosen.serviceKey,
                paymentToken,
              },
        );
        if (outcome.status === "needs_approval") {
          await payment.approve(outcome.secret);
          await postJson<AcceptOutcome>(
            `/api/quotes/mine/${quote.id}/accept/finalize`,
          );
        }
      },
      quote.plan ? t.w.planStartedToast : t.w.bookedToast,
    );

  return (
    <Section
      title={
        quote.plan
          ? depositCents > 0
            ? t.w.payAndStart
            : t.w.startPlan
          : depositCents > 0
            ? t.p.payAndBook
            : t.w.book
      }
    >
      <Card>
        {newCard ? (
          <div className="flex flex-col gap-2">
            {payment.field}
            {paymentMethod && (
              <Button
                variant="text"
                size="sm"
                className="self-start"
                onPress={() => setNewCard(false)}
              >
                {t.w.useYour(paymentMethod.label)}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CreditCard aria-hidden size={18} className="text-fg-muted" />
              {t.w.payingWith(paymentMethod?.label ?? t.w.savedCard)}
            </span>
            <Button variant="text" size="sm" onPress={() => setNewCard(true)}>
              {t.p.differentCard}
            </Button>
          </div>
        )}

        <p className="text-sm text-fg-muted">
          {quote.plan
            ? `${depositCents > 0 ? t.w.takeAndKeep(t.formatMoney(depositCents)) : ""}${eachClean(t, quote, chosen)}${t.w.firstOn(t.formatDateTime(quote.proposedStartsAt))}`
            : `${oneOffPayment(t, quote, chosen, balance)}${t.w.bookedFor(t.formatDateTime(quote.proposedStartsAt))}`}
        </p>
        {newCard && <ConsentNote action="paying" />}
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Decline quote={quote} />
          <Button
            isPending={action.isPending}
            isDisabled={!payment.isReady}
            onPress={() => void accept()}
          >
            {depositCents > 0
              ? t.w.acceptPay(t.formatMoney(depositCents))
              : t.w.acceptBook}
          </Button>
        </Actions>
      </Card>
    </Section>
  );
}

// how a one-off clean is paid: the Deposit now, if any, and the rest when
// it's done, or on its week's Bill for a Client billed weekly (ADR-0016)
const oneOffPayment = (
  t: Said & { w: (typeof words)["en"] },
  quote: QuoteView,
  chosen: QuoteOption,
  balance: number,
) => {
  const billed =
    quote.weeklyBill && `${t.ON_WEEKS_BILL}, ${t.billPaid[quote.weeklyBill]}`;
  return chosen.depositCents > 0
    ? billed
      ? t.w.takeRestBilled(
          t.formatMoney(chosen.depositCents),
          t.formatMoney(balance),
          billed,
        )
      : t.w.takeRestDone(
          t.formatMoney(chosen.depositCents),
          t.formatMoney(balance),
        )
    : t.w.nothingNow(
        t.formatMoney(chosen.totalCents),
        billed || t.w.chargedWhenDone,
      );
};

// what each of a plan's cleans costs, when its days cost the same, and how
// it's paid: when it's done, or on a weekly Bill
const eachClean = (
  t: Said & { w: (typeof words)["en"] },
  quote: QuoteView,
  chosen: QuoteOption,
) => {
  const price =
    quote.options.length === 1 ? t.formatMoney(chosen.totalCents) : null;
  return quote.weeklyBill
    ? `${price ? t.w.eachIs(price) : ""}${t.cleansPaid(quote.weeklyBill)}`
    : t.w.eachCharged(price);
};

// accepting a Quote that changes the home's plan: nothing to pay, as the
// plan's Deposit carries over
function AcceptChange({ quote }: { quote: QuoteView }) {
  const t = useSaid(words);
  const action = useAction(t.p.didntWork, {
    reloadOnFailure: true,
  });
  const [first] = quote.options;

  const accept = () =>
    action.run(
      () =>
        postJson<AcceptOutcome>(`/api/quotes/mine/${quote.id}/accept`, {
          revisionId: quote.revisionId,
        }),
      t.w.planChangedToast,
    );

  return (
    <Section title={t.w.acceptNew}>
      <Card>
        <p className="text-sm text-fg-muted">
          {t.w.nothingCharged} {eachClean(t, quote, first!)}
          {t.w.newStart(t.formatDateTime(quote.proposedStartsAt))}
        </p>
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Decline quote={quote} />
          <Button isPending={action.isPending} onPress={() => void accept()}>
            {t.w.acceptNew}
          </Button>
        </Actions>
      </Card>
    </Section>
  );
}

// beside accepting, quietly: they're asked once more before it's done
function Decline({ quote }: { quote: QuoteView }) {
  const t = useSaid(words);
  const action = useAction(t.p.didntWork);

  const decline = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(`/api/quotes/mine/${quote.id}/decline`),
      t.w.declined,
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="text">{t.w.decline}</Button>
      <Dialog title={t.w.declineQ} role="alertdialog">
        {({ close }) => (
          <>
            <p>{t.w.thanks}</p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                {t.w.keep}
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() => void decline(close)}
              >
                {t.w.declineButton}
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}
