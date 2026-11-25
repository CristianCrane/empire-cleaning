import { useState, type ComponentProps, type ReactNode } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import {
  CalendarClock,
  Clock,
  CircleX,
  ClipboardPenLine,
  CreditCard,
  MapPin,
  CalendarDays,
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
  Button,
  Card,
  Section,
  Dialog,
  DialogTrigger,
  IconTile,
  Notice,
  RadioCard,
  RadioGroup,
  StatusBadge,
  Fact,
  Figure,
  Figures,
  RecordPage,
  DetailsCard,
  Facts,
  type Alert,
  type DialogState,
  ButtonLink,
  Line,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { type Action, useAction } from "../action.ts";
import { useWhilePaying } from "../paying.ts";
import { addressOf, formatMinutes, lineOf } from "../format.ts";
import { ConditionIcon, QuoteIcon } from "../icons.ts";
import { type Said, useSaid } from "../words.ts";
import {
  AskedRows,
  PlanDayCard,
  planCards,
  PlanTotals,
  ClientQuoteStatusBadge,
} from "../QuoteParts.tsx";
import { HowLongFacts } from "../PlanParts.tsx";
import { ConsentNote, usePaymentForm } from "./CardForm.tsx";
import {
  catalog,
  depositAlertOf,
  depositGoalOf,
  filledDaysOf,
  howLong,
  inLine,
  oneStop,
} from "@empire-cleaning/models";
import { waitLabelOf, waitOf } from "../QuoteParts.tsx";
import { requestQuoteHref } from "./whats-next.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    updated: (day: string) => `Updated ${day}`,
    comeToSee: (
      premises: boolean,
      visitor: string,
      when: string,
      length: string,
    ) =>
      `We'll come to see ${premises ? "the business" : "your home"} first, for free: ${visitor} visits on ${when}, for about ${length}. We email your quote after the visit. To change the time, please call us.`,
    askedFor: "What you asked for",
    asked: "Asked",
    yourKind: (kind: string) => `Your ${kind.toLowerCase()}`,
    details: "Quote details",
    aWeekTax: "A week's cleans, tax included",
    aCleanTax: (service: string) => `${service}, a clean, tax included`,
    when: "When",
    from: (when: string) => `From ${when}`,
    yourClean: "Your clean",
    chooseClean: "Choose your clean",
    recommend: (recommended: string, own: string) =>
      `We recommend a ${recommended} for a first visit: it brings your home up to standard. A ${own} costs less.`,
    recommended: "Recommended",
    // how long it runs, as the clean's page says it
    hoursDeposit: (hours: string, deposit: string) =>
      lineOf([hours, `${deposit} deposit`]),
    noLongerFits:
      "No longer fits on that day: it has filled up since we sent this quote",
    onEvery: (extras: string) => `On every clean, included: ${extras}`,
    includes: (extras: string) => `Includes ${extras}`,
    tax: "Tax",
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
    bookedFor: (when: string) => ` Accepting books your clean for ${when}.`,
    acceptPay: (amount: string) => `Accept and pay ${amount}`,
    acceptBook: "Accept and book",
    // the Deposit and the rest are the figures just above
    takeRestBilled: (billed: string) =>
      `We take the deposit now, and the rest ${billed}.`,
    takeRestDone:
      "We take the deposit now, and the rest when the clean is done.",
    nothingNow: (total: string, how: string) =>
      `Nothing is taken now. The ${total} ${how}.`,
    eachIs: (price: string) => `Each clean is ${price}. `,
    eachCharged: (price: string | null) =>
      price
        ? `Each clean, ${price}, is charged when it's done.`
        : "Each clean is charged when it's done.",
    planChangedToast: "Your cleaning plan has changed",
    acceptNew: "Accept the new terms",
    nothingCharged: "Nothing is charged now.",
    newStart: (when: string) => ` The new terms start on ${when}.`,
    declined: "Quote declined",
    decline: "Decline this quote",
    declineQ: "Decline this quote?",
    thanks:
      "Thanks for letting us know. You can ask us for a new quote whenever you like.",
    // declining a quote their bank still asks them to approve a payment
    // on, or a card (a 0% Deposit), for
    callsOff: (card: boolean) =>
      card
        ? "Your bank's request to approve your card is called off, so your card isn't saved."
        : "The payment waiting on your bank is called off, so you won't be charged.",
    keep: "Keep it",
  },
  es: {
    updated: (day: string) => `Actualizada el ${day}`,
    comeToSee: (
      premises: boolean,
      visitor: string,
      when: string,
      length: string,
    ) =>
      `Primero iremos a ver ${premises ? "el negocio" : "su casa"}, sin costo: ${visitor} lo visita el ${when}, durante cerca de ${length}. Le enviamos la cotización por correo después de la visita. Para cambiar la hora, por favor llámenos.`,
    askedFor: "Lo que pidió",
    asked: "Pedida",
    yourKind: (kind: string) => `Su ${kind.toLowerCase()}`,
    details: "Detalles de la cotización",
    aWeekTax: "Las limpiezas de una semana, impuestos incluidos",
    aCleanTax: (service: string) =>
      `${service}, por limpieza, impuestos incluidos`,
    when: "Cuándo",
    from: (when: string) => `Desde el ${when}`,
    yourClean: "Su limpieza",
    chooseClean: "Elija su limpieza",
    recommend: (recommended: string, own: string) =>
      `Le recomendamos una ${recommended} para la primera visita: deja su casa en buen estado. Una ${own} cuesta menos.`,
    recommended: "Recomendada",
    hoursDeposit: (hours: string, deposit: string) =>
      lineOf([hours, `${deposit} de depósito`]),
    noLongerFits:
      "Ya no cabe ese día: se llenó después de que le enviamos esta cotización",
    onEvery: (extras: string) => `En cada limpieza, incluido: ${extras}`,
    includes: (extras: string) => `Incluye ${extras}`,
    tax: "Impuestos",
    deposit: (percent: number, paid: boolean) =>
      `Depósito (${percent}%)${paid ? ", pagado" : ""}`,
    restOnBill: "El resto, en la factura de esa semana",
    restWhenDone: "El resto, cuando la limpieza esté terminada",
    planChanged: (when: string) =>
      oneStop(
        `Su plan de limpieza cambió: tiene estas condiciones desde el ${when}.`,
      ),
    planStarted: (when: string) =>
      oneStop(`Su plan de limpieza empezó: su primera limpieza es el ${when}.`),
    acceptedOn: (when: string) => oneStop(`Aceptó esta cotización el ${when}.`),
    booked: (service: string, when: string) =>
      oneStop(`Está reservado: ${service} el ${when}.`),
    declinedOn: (when: string) =>
      oneStop(`Rechazó esta cotización el ${when}.`),
    expiredOn: (when: string) => oneStop(`Esta cotización venció el ${when}.`),
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
    firstOn: (when: string) => oneStop(` La primera es el ${when}.`),
    bookedFor: (when: string) =>
      oneStop(` Al aceptar, su limpieza queda reservada para el ${when}.`),
    acceptPay: (amount: string) => `Aceptar y pagar ${amount}`,
    acceptBook: "Aceptar y reservar",
    takeRestBilled: (billed: string) =>
      `Cobramos ahora el depósito, y el resto ${billed}.`,
    takeRestDone:
      "Cobramos ahora el depósito, y el resto cuando la limpieza esté terminada.",
    nothingNow: (total: string, how: string) =>
      `No se cobra nada ahora. El total de ${total} ${how}.`,
    eachIs: (price: string) => `Cada limpieza cuesta ${price}. `,
    eachCharged: (price: string | null) =>
      price
        ? `Cada limpieza, de ${price}, se cobra cuando esté terminada.`
        : "Cada limpieza se cobra cuando esté terminada.",
    planChangedToast: "Su plan de limpieza cambió",
    acceptNew: "Aceptar las nuevas condiciones",
    nothingCharged: "No se cobra nada ahora.",
    newStart: (when: string) =>
      oneStop(` Las nuevas condiciones empiezan el ${when}.`),
    declined: "Cotización rechazada",
    decline: "Rechazar esta cotización",
    declineQ: "¿Rechazar esta cotización?",
    thanks:
      "Gracias por avisarnos. Puede pedirnos una nueva cotización cuando quiera.",
    callsOff: (card: boolean) =>
      card
        ? "La solicitud de su banco para aprobar su tarjeta se cancela, así que su tarjeta no se guarda."
        : "El pago pendiente en su banco se cancela, así que no se le cobrará.",
    keep: "Conservarla",
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

// a Quote's page, a Record (docs/ux.md): the header every Quote of theirs
// shares, then its own
function QuotePage({
  quote,
  title,
  updatedAt = null,
  openUntil = null,
  badge = <ClientQuoteStatusBadge status={quote.status} />,
  ...page
}: {
  quote: ClientQuoteView;
  title: string;
  updatedAt?: string | null;
  // while an offer is open
  openUntil?: string | null;
  // the status's own, unless the page knows more
  badge?: ReactNode;
} & Pick<
  ComponentProps<typeof RecordPage>,
  "next" | "actions" | "alerts" | "details" | "children"
>) {
  const t = useSaid(words);
  // none when there's nothing to say, so the header draws no empty line
  const open = openUntil && t.p.openUntil(t.formatDateTime(openUntil));
  const subtitle = (updatedAt || openUntil) && (
    <Line
      parts={[
        // a resend replaced the offer they may have seen before
        updatedAt && t.w.updated(t.formatDate(updatedAt)),
        // after it, reading on from the dot
        updatedAt && open ? inLine(open) : open,
      ]}
    />
  );
  return (
    <RecordPage
      trail={[
        { label: t.p.home, href: linkTo({ to: "/portal" }) },
        { label: t.p.yourQuote },
      ]}
      title={title}
      status={badge}
      subtitle={subtitle}
      {...page}
    />
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
    <QuotePage
      quote={quote}
      title={t.p.yourQuote}
      // asking again is the one way on from a no
      next={
        quote.status === "turned_down"
          ? {
              label: t.REQUEST_A_QUOTE,
              icon: ClipboardPenLine,
              href: requestQuoteHref,
            }
          : undefined
      }
      alerts={[
        quote.status === "turned_down"
          ? {
              key: "turned down",
              children: `${t.turnedDown(quote.turnDownReason!)} ${t.ASK_AGAIN}`,
            }
          : siteVisit
            ? {
                key: "visit",
                children: t.w.comeToSee(
                  premises,
                  siteVisit.visitorName,
                  t.formatDateTime(siteVisit.startsAt),
                  formatMinutes(siteVisit.minutes),
                ),
              }
            : { key: "working", children: t.WORKING_ON_IT },
      ]}
      details={
        <DetailsCard label={t.w.askedFor}>
          <Facts>
            <Fact
              icon={MapPin}
              label={t.p.where}
              value={addressOf(quote.property)}
              line={t.p.yourHome}
            />
            <Fact
              icon={CalendarDays}
              label={t.w.asked}
              value={t.formatDate(quote.createdAt)}
            />
            {!premises && (
              <Fact
                icon={ConditionIcon}
                label={t.condition}
                value={t.conditionLabel[asked.condition!]}
              />
            )}
            <AskedRows asked={asked} premises={premises} />
          </Facts>
        </DetailsCard>
      }
    />
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
  const router = useRouter();
  const { paying } = quote;
  const open = quote.status === "sent";
  // their bank finishing a payment on it (#534's UX design, Screen 1b): it
  // books on its own, so nothing on the page asks anything more of them,
  // and its clean is the one paid for
  const going = open && paying?.status === "goingThrough" ? paying : null;
  // the clean chosen: the one accepted, or the one they last paid for, or
  // the recommended one, unless only the other still fits
  const [serviceKey, setServiceKey] = useState(
    quote.acceptedServiceKey ??
      (paying && quote.bookable.includes(paying.serviceKey)
        ? paying.serviceKey
        : (
            quote.options.find((o) => quote.bookable.includes(o.serviceKey)) ??
            quote.options[0]!
          ).serviceKey),
  );
  const chosen =
    quote.options.find(
      (o) => o.serviceKey === (going ? going.serviceKey : serviceKey),
    ) ?? quote.options[0]!;
  // the page looks again while their bank has it, so it reads booked, or
  // free again, once it is
  useWhilePaying(
    open && paying?.status === "approving"
      ? paying
      : going
        ? { finishing: true }
        : null,
    () => router.invalidate(),
  );

  // Accept and pay, here so the page's alert can answer it: where the
  // payment stands, in the words the server answers with (Screen 1d), said
  // once, the alert's, and focused on each press; what else went wrong
  // stays by the button
  const action = useAction(t.p.didntWork, { reloadOnFailure: true });
  const [answer, setAnswer] = useState<{ n: number; said?: string }>();
  const alert = depositAlertOf(t.lang, quote);
  const problem = action.problem !== alert?.text ? action.problem : undefined;

  // what it waits on that's nothing of theirs, its badge as Home's card and
  // its home's row name it: its payment going through, or its day filled
  // up after it was sent (bookedUp): nothing to pay for, as we send a new
  // quote, so saying no is what's left
  const wait = waitOf(quote);
  const bookedUp = wait === "filled";
  // a payment refunded as its time filled says so, and that a new quote
  // comes, itself
  const filled = paying?.status === "refunded" && paying.why === "no_room";
  return (
    <QuotePage
      quote={quote}
      title={t.w.yourKind(t.quoteKindName(quote.kind))}
      updatedAt={quote.updatedAt}
      openUntil={open && !wait ? quote.expiresAt : null}
      badge={
        wait ? (
          <StatusBadge tone="info">{waitLabelOf(t.lang, wait)}</StatusBadge>
        ) : undefined
      }
      actions={
        bookedUp
          ? [
              {
                label: t.w.decline,
                icon: CircleX,
                dialog: (state) => <DeclineDialog quote={quote} {...state} />,
              },
            ]
          : undefined
      }
      alerts={[
        // an expiry its payment's alert says, with what became of it
        !(quote.status === "expired" && alert) && standing(t, quote, chosen),
        alert && {
          // a new key for each press, so the alert answers each
          key: `paying ${answer?.n ?? 0}`,
          tone: alert.tone,
          answers: !!answer && !problem,
          // pressed from a page opened before their bank took the first:
          // that nothing more was taken
          children: (going && answer?.said) || alert.text,
        },
        quote.changesPlan &&
          open && {
            key: "plan change",
            children: (
              <PlanChangeText quote={quote} change={quote.changesPlan} />
            ),
          },
        bookedUp &&
          !filled && {
            key: "filled up",
            children: `${t.bookedUp(
              filledDaysOf({
                plan: quote.plan,
                changes: Boolean(quote.changesPlan),
              }),
              t.formatDateTime(quote.proposedStartsAt),
            )} ${t.NEW_QUOTE}`,
          },
      ]}
      details={
        <QuoteDetails
          quote={quote}
          chosen={chosen}
          bookedUp={bookedUp}
          going={!!going}
          onChoose={setServiceKey}
        />
      }
    >
      {open &&
        !going &&
        quote.bookable.length > 0 &&
        (quote.changesPlan ? (
          <AcceptChange quote={quote} />
        ) : (
          <Accept
            quote={quote}
            chosen={chosen}
            paymentMethod={paymentMethod}
            action={action}
            problem={problem}
            onAnswer={(said) =>
              setAnswer((a) => ({ n: (a?.n ?? 0) + 1, said }))
            }
          />
        ))}
    </QuotePage>
  );
}

// The Quote itself, as one card: what it comes to, when, where and for how
// long, the clean to choose (or a plan's days), then the money line by line
function QuoteDetails({
  quote,
  chosen,
  bookedUp = false,
  going = false,
  onChoose,
}: {
  quote: QuoteView;
  chosen: QuoteOption;
  // no option fits its day any more: the page's alert says so
  bookedUp?: boolean;
  // their bank finishing a payment for `chosen`: nothing left to choose
  going?: boolean;
  onChoose: (serviceKey: string) => void;
}) {
  const t = useSaid(words);
  const { plan } = quote;
  const cards = plan ? planCards(plan.days, quote.options) : [];
  const choosing =
    !plan && !going && quote.options.length > 1 && quote.status === "sent";
  const [recommended, own] = quote.options;
  const extras = chosen.addOns.map((a) => a.name).join(", ");

  return (
    <DetailsCard
      label={t.w.details}
      tile={<IconTile icon={QuoteIcon} size="lg" />}
      kicker={
        plan
          ? plan.days.length > 1
            ? t.w.aWeekTax
            : t.w.aCleanTax(chosen.serviceName)
          : t.taxIncludedOf(chosen.serviceName)
      }
      title={
        <span className="tabular-nums">
          {t.formatMoney(
            plan && plan.days.length > 1
              ? plan.roundTotalCents
              : chosen.totalCents,
          )}
        </span>
      }
    >
      <Facts>
        <Fact
          icon={CalendarClock}
          label={t.w.when}
          value={
            plan ? t.planRhythm(plan) : t.formatDateTime(quote.proposedStartsAt)
          }
          line={
            plan
              ? t.w.from(t.formatDateTime(quote.proposedStartsAt))
              : t.w.yourClean
          }
        />
        <Fact
          icon={MapPin}
          label={t.p.where}
          value={addressOf(quote.property)}
          line={t.p.yourHome}
        />
        {plan ? (
          <HowLongFacts
            days={plan.days.map((day, i) => ({
              // a weekday's time is unset only on a Draft, which no Client
              // sees
              startsAt: day.startsAt!,
              hoursOnSite: quote.options[i]!.hoursOnSite,
            }))}
          />
        ) : (
          <Fact
            icon={Clock}
            label={t.howLong}
            value={howLong(t, chosen.hoursOnSite)}
          />
        )}
      </Facts>

      {choosing && (
        <div className="border-t border-border pt-4">
          <RadioGroup
            label={t.w.chooseClean}
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
                    <StatusBadge tone="success">{t.w.recommended}</StatusBadge>
                  )
                }
              >
                <span className="font-display text-3xl font-bold tabular-nums">
                  {t.formatMoney(option.totalCents)}
                </span>
                <span className="text-sm text-fg-muted">
                  {quote.bookable.includes(option.serviceKey) || bookedUp
                    ? t.w.hoursDeposit(
                        howLong(t, option.hoursOnSite),
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
          <div
            className={`grid gap-4 ${cards.length > 1 ? "lg:grid-cols-2" : ""}`}
          >
            {cards.map((cleans) => (
              <PlanDayCard
                key={cleans[0]!.day.startsAt}
                cleans={cleans}
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
          <Figures>
            <Figure
              // the extras its price includes, under its name
              label={
                <>
                  {chosen.serviceName}
                  {extras && (
                    <span className="block">{t.w.includes(extras)}</span>
                  )}
                </>
              }
              value={t.formatMoney(chosen.priceCents)}
            />
            <Figure label={t.w.tax} value={t.formatMoney(chosen.taxCents)} />
            <Figure
              label={t.total}
              value={t.formatMoney(chosen.totalCents)}
              total
            />
            {chosen.depositCents > 0 && (
              <>
                <Figure
                  label={t.w.deposit(
                    quote.depositPercent,
                    quote.status === "accepted",
                  )}
                  value={t.formatMoney(chosen.depositCents)}
                  strong
                />
                <Figure
                  label={quote.weeklyBill ? t.w.restOnBill : t.w.restWhenDone}
                  value={t.formatMoney(chosen.totalCents - chosen.depositCents)}
                />
              </>
            )}
          </Figures>
        )}
      </div>
    </DetailsCard>
  );
}

// how it ended, once it's closed; while it's open, its header says until
// when
function standing(
  t: Said & { w: (typeof words)["en"] },
  quote: QuoteView,
  chosen: QuoteOption,
): Alert | null {
  const proposed = t.formatDateTime(quote.proposedStartsAt);
  switch (quote.status) {
    case "accepted":
      return {
        key: "accepted",
        tone: "success",
        action: quote.servicePlanId && (
          <ButtonLink
            variant="text"
            href={linkTo({
              to: "/portal/plans/$planId",
              params: { planId: quote.servicePlanId },
            })}
          >
            {t.p.seeYourCleaningPlan}
          </ButtonLink>
        ),
        children: `${
          quote.servicePlanId
            ? quote.changedPlan
              ? t.w.planChanged(proposed)
              : t.w.planStarted(proposed)
            : t.w.booked(chosen.serviceName, proposed)
        } ${t.w.acceptedOn(t.formatDateTime(quote.acceptedAt!))}`,
      };
    case "declined":
      return {
        key: "declined",
        children: t.w.declinedOn(t.formatDateTime(quote.declinedAt!)),
      };
    case "expired":
      return {
        key: "expired",
        children: t.w.expiredOn(t.formatDateTime(quote.expiresAt)),
      };
    default:
      return null;
  }
}

// what accepting a Quote for a home with a plan does to that plan, said in
// an alert
function PlanChangeText({
  quote,
  change,
}: {
  quote: QuoteView;
  change: PlanChange;
}) {
  const t = useSaid(words);
  return (
    <>
      <p>
        <strong>{t.w.changesPlan}</strong>
      </p>
      <p>{t.w.movesTerms(t.formatDateTime(quote.proposedStartsAt))}</p>
      {change.replaces.length > 0 && (
        <p>
          {t.w.replaces(change.replaces.length)}{" "}
          {oneStop(
            `${change.replaces.map((at) => t.formatDateTime(at)).join("; ")}.`,
          )}
        </p>
      )}
      <p>{t.w.depositStays(t.formatMoney(change.depositCents))}</p>
    </>
  );
}

// One step under the Quote: enter a card (or keep the saved one) and accept
// the clean chosen above. The Deposit is taken, saving a card entered now,
// and the Job booked, or none of it. If their bank wants them to approve the
// payment, that happens here too, then the booking is finished. A Service
// Plan Quote is accepted whole, with a clean on each of its weekdays, and
// starts the plan, whose Deposit is held for as long as it runs. Where a
// payment that didn't book stands is the page's alert's to say (#534):
// `onAnswer` tells it of each press, with the server's own words when they
// say more than the page's
function Accept({
  quote,
  chosen,
  paymentMethod,
  action,
  problem,
  onAnswer,
}: {
  quote: QuoteView;
  chosen: QuoteOption;
  paymentMethod: PaymentMethodView | null;
  // reloading on a failure, as what's bookable may have changed since the
  // page loaded
  action: Action;
  // what went wrong that the page's alert doesn't say
  problem: string | undefined;
  onAnswer: (said?: string) => void;
}) {
  const t = useSaid(words);
  const [newCard, setNewCard] = useState(!paymentMethod);
  const depositCents = quote.plan?.depositCents ?? chosen.depositCents;
  const payment = usePaymentForm({
    amountCents: depositCents,
    showCard: newCard,
  });

  const accept = async () => {
    let said: string | undefined;
    await action.run(
      async () => {
        const done = await payment.pay({
          start: (paymentToken) =>
            postJson<AcceptOutcome>(
              `/api/quotes/mine/${quote.id}/accept`,
              // a plan is accepted whole
              quote.plan
                ? { revisionId: quote.revisionId, paymentToken }
                : {
                    revisionId: quote.revisionId,
                    serviceKey: chosen.serviceKey,
                    paymentToken,
                  },
            ),
          // approved or not, their bank's answer is the server's to find,
          // and the page's alert to say, as one press tells of it as the
          // page then does
          finish: () =>
            postJson<AcceptOutcome>(
              `/api/quotes/mine/${quote.id}/accept/finalize`,
            ),
        });
        if (done.status === "processing") said = done.message;
        return done;
      },
      (done) =>
        done.status !== "accepted"
          ? ""
          : quote.plan
            ? t.w.planStartedToast
            : t.w.bookedToast,
    );
    onAnswer(said);
  };

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
            : `${oneOffPayment(t, quote, chosen)}${t.w.bookedFor(t.formatDateTime(quote.proposedStartsAt))}`}
        </p>
        {newCard && <ConsentNote action="paying" />}
        {problem && <Notice tone="danger">{problem}</Notice>}
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
) => {
  const billed =
    quote.weeklyBill && `${t.ON_WEEKS_BILL}, ${t.billPaid[quote.weeklyBill]}`;
  return chosen.depositCents > 0
    ? billed
      ? t.w.takeRestBilled(billed)
      : t.w.takeRestDone
    : t.w.nothingNow(
        t.formatMoney(chosen.totalCents),
        billed || t.CHARGED_WHEN_DONE,
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

// beside accepting, quietly, or the page's one action once its time filled up:
// they're asked once more before it's done. Not red, as they can ask for a
// quote again (the `ui` skill)
function Decline({ quote }: { quote: QuoteView }) {
  const t = useSaid(words);
  return (
    <DialogTrigger>
      <Button variant="quiet">{t.w.decline}</Button>
      <DeclineDialog quote={quote} />
    </DialogTrigger>
  );
}

function DeclineDialog({
  quote,
  ...state
}: { quote: QuoteView } & Partial<DialogState>) {
  const t = useSaid(words);
  const router = useRouter();
  // not reloading on a failure, which would close the dialog before it
  // says why: its page catches up as it closes
  const action = useAction(t.p.didntWork);
  const { paying } = quote;
  // their bank started finishing a payment on it since the page loaded:
  // too far on to call off, so it may still book (#534's UX design,
  // Screen 1c). Not an error, and declining waits till it's done
  const finishing = [false, true].some(
    (card) => action.problem === t.depositNoDecline(depositGoalOf(quote), card),
  );

  const decline = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(`/api/quotes/mine/${quote.id}/decline`),
      t.w.declined,
    );
    if (ok) close();
  };
  const keep = (close: () => void) => {
    close();
    if (action.problem) void router.invalidate();
  };

  return (
    <Dialog title={t.w.declineQ} role="alertdialog" {...state}>
      {({ close }) => (
        <>
          <p>{t.w.thanks}</p>
          {/* what declining does to a payment their bank still asks them
              to approve (Screen 1b) */}
          {paying?.status === "approving" && (
            <p>{t.w.callsOff(paying.depositCents === 0)}</p>
          )}
          {action.problem && (
            <Notice tone={finishing ? "info" : "danger"}>
              {action.problem}
            </Notice>
          )}
          <Actions>
            <Button variant="quiet" onPress={() => keep(close)}>
              {t.w.keep}
            </Button>
            <Button
              isPending={action.isPending}
              isDisabled={finishing}
              onPress={() => void decline(close)}
            >
              {t.p.decline}
            </Button>
          </Actions>
        </>
      )}
    </Dialog>
  );
}
