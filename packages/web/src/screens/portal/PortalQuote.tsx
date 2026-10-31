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
  TurnDownReason,
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
import {
  addressOf,
  conditionLabel,
  formatDate,
  formatDateTime,
  formatHours,
  formatMinutes,
  formatMoney,
  planRhythm,
  wantedCleaning,
} from "../format.ts";
import { Fact } from "../Fact.tsx";
import { PlanDayCard, PlanTotals, QuoteStatusBadge } from "../QuoteParts.tsx";
import { ConsentNote, usePaymentForm } from "./CardForm.tsx";

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
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        trail={[
          { label: "Home", href: linkTo({ to: "/portal" }) },
          { label: "Your Quote" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>{title}</Heading>
        <QuoteStatusBadge status={quote.status} />
      </div>
      <p className="text-fg-muted">
        {addressOf(quote.property)}
        {/* a resend replaced the offer they may have seen before */}
        {updatedAt && ` · Updated ${formatDate(updatedAt)}`}
        {openUntil && ` · Open until ${formatDateTime(openUntil)}`}
      </p>
    </div>
  );
}

// why the Office couldn't quote, as the Turned Down email says it
const turnDownWording: Record<TurnDownReason, string> = {
  out_of_area: "it's outside the area we clean",
  out_of_scope: "it needs more than the cleaning we offer",
  no_capacity: "we don't have room for it at the moment",
};

// what they asked for, while the Office prepares the Quote, or once it's
// Turned Down
function AskedQuote({ quote }: { quote: AskedQuoteView }) {
  const { asked, siteVisit } = quote;
  // a business states no Condition: a Site Visit finds it
  const premises = asked.condition === null;

  return (
    <div className="flex flex-col gap-6">
      <QuoteHeader quote={quote} title="Your Quote" />

      {quote.status === "turned_down" ? (
        <Notice>
          <p>
            We're sorry, but we can't quote for{" "}
            {premises ? "these premises" : "this home"}:{" "}
            {turnDownWording[quote.turnDownReason!]}. If anything changes,
            you're welcome to ask us again.
          </p>
          <p>
            <Link href={linkTo({ to: "/portal/request" })}>
              Request a Quote
            </Link>
          </p>
        </Notice>
      ) : siteVisit ? (
        <Notice tone="info">
          We'll come to see {premises ? "the premises" : "your home"} first, for
          free: {siteVisit.visitorName} visits on{" "}
          {formatDateTime(siteVisit.startsAt)}, for about{" "}
          {formatMinutes(siteVisit.minutes)}. We email your Quote after the
          visit. To change the time, please call us.
        </Notice>
      ) : (
        <Notice tone="info">
          We're preparing your Quote, and we'll email it to you, usually within
          a working day.
        </Notice>
      )}

      <Section title="What you asked for">
        <Card>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">Asked</dt>
            <dd>{formatDate(quote.createdAt)}</dd>
            {premises ? (
              <>
                <dt className="font-semibold">Cleaning wanted</dt>
                <dd>{wantedCleaning(asked)}</dd>
              </>
            ) : (
              <>
                <dt className="font-semibold">Condition</dt>
                <dd>{conditionLabel[asked.condition!]}</dd>
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
        title={quote.plan ? "Your Service Plan Quote" : "Your Quote"}
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
              Sorry,{" "}
              {quote.plan && quote.plan.days.length > 1
                ? "one of the days your plan starts on has"
                : `${formatDateTime(quote.proposedStartsAt)} has`}{" "}
              been fully booked since we sent this Quote, so it can't be
              accepted. We've let our team know, and we'll send you a new Quote
              for another time.
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
  const { plan } = quote;
  const choosing = !plan && quote.options.length > 1 && quote.status === "sent";
  const [recommended, own] = quote.options;
  const extras = quote.addOns.map((a) => a.name).join(", ");

  return (
    <Section title="Quote details">
      <Card>
        <div className="flex flex-col gap-5">
          {/* what it comes to */}
          <div className="flex items-start gap-3">
            <IconTile icon={FileText} />
            <div className="flex min-w-0 flex-col">
              <span className="font-display text-4xl font-bold tracking-wide tabular-nums">
                {formatMoney(
                  plan && plan.days.length > 1
                    ? plan.roundTotalCents
                    : chosen.totalCents,
                )}
              </span>
              <span className="text-sm text-fg-muted">
                {plan
                  ? plan.days.length > 1
                    ? "A week, with a clean on each day, tax included"
                    : `${chosen.serviceName}, a clean, tax included`
                  : `${chosen.serviceName}, tax included`}
              </span>
            </div>
          </div>

          <div className="@container">
            <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-3">
              <Fact
                icon={CalendarClock}
                label="When"
                value={
                  plan
                    ? planRhythm(plan)
                    : formatDateTime(quote.proposedStartsAt)
                }
                line={
                  plan
                    ? `From ${formatDateTime(quote.proposedStartsAt)}`
                    : "Your clean"
                }
              />
              <Fact
                icon={MapPin}
                label="Where"
                value={addressOf(quote.property)}
                line="Your home"
              />
              <Fact
                icon={Users}
                label="On site"
                value={`${quote.crewSize} ${quote.crewSize === 1 ? "Cleaner" : "Cleaners"}, about ${formatHours(chosen.hoursOnSite)}`}
                line="On site"
              />
            </dl>
          </div>

          {choosing && (
            <div className="border-t border-border pt-4">
              <RadioGroup
                label="Your clean"
                description={`We recommend a ${recommended!.serviceName} for a first visit: it brings your home up to standard. A ${own!.serviceName} costs less.`}
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
                        <StatusBadge tone="success">Recommended</StatusBadge>
                      )
                    }
                  >
                    <span className="font-display text-3xl font-bold tabular-nums">
                      {formatMoney(option.totalCents)}
                    </span>
                    <span className="text-sm text-fg-muted">
                      {quote.bookable.includes(option.serviceKey)
                        ? `${formatHours(option.labourHours)} of cleaning · ${formatMoney(option.depositCents)} Deposit`
                        : "No longer fits on that day: it's been booked up since we sent this Quote"}
                    </span>
                  </RadioCard>
                ))}
              </RadioGroup>
            </div>
          )}

          {plan && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-sm text-fg-muted">
                {plan.days.length > 1 ? "One clean a day. " : ""}Each clean is{" "}
                {plan.discountPercent}% off what it would cost as a one-off.
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
                  <p className="text-sm text-fg-muted">
                    On every clean, included: {extras}
                  </p>
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
                  value={formatMoney(chosen.priceCents)}
                />
                {extras && <p className="text-fg-muted">Includes {extras}</p>}
                <Line label="Tax" value={formatMoney(chosen.taxCents)} />
                <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold text-fg">
                  <dt>Total</dt>
                  <dd className="tabular-nums">
                    {formatMoney(chosen.totalCents)}
                  </dd>
                </div>
                {chosen.depositCents > 0 && (
                  <>
                    <Line
                      label={`Deposit (${quote.depositPercent}%)${quote.status === "accepted" ? ", paid" : ""}`}
                      value={formatMoney(chosen.depositCents)}
                      strong
                    />
                    <Line
                      label="The rest, when the clean is done"
                      value={formatMoney(
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
  const proposed = formatDateTime(quote.proposedStartsAt);
  switch (quote.status) {
    case "accepted":
      return quote.servicePlanId ? (
        <Notice tone="success">
          {quote.changedPlan
            ? `Your Service Plan has changed: it's on these terms from ${proposed}.`
            : `Your Service Plan has started: its first clean is on ${proposed}.`}{" "}
          You accepted this Quote on {formatDateTime(quote.acceptedAt!)}.{" "}
          <Link
            href={linkTo({
              to: "/portal/plans/$planId",
              params: { planId: quote.servicePlanId },
            })}
          >
            See your Service Plan
          </Link>
        </Notice>
      ) : (
        <Notice tone="success">
          You're booked: a {chosen.serviceName} on {proposed}. You accepted this
          Quote on {formatDateTime(quote.acceptedAt!)}.
        </Notice>
      );
    case "declined":
      return (
        <Notice>
          You declined this Quote on {formatDateTime(quote.declinedAt!)}.
        </Notice>
      );
    case "expired":
      return (
        <Notice>
          This Quote expired on {formatDateTime(quote.expiresAt)}.
        </Notice>
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
  return (
    <Notice tone="info">
      <strong>This changes your Service Plan</strong>
      <p>
        From {formatDateTime(quote.proposedStartsAt)}, your plan moves to the
        terms below. Cleans before then go ahead as they are.
      </p>
      {change.replaces.length > 0 && (
        <p>
          {change.replaces.length === 1
            ? "The clean you have booked from then on is cancelled, at no charge:"
            : "The cleans you have booked from then on are cancelled, at no charge:"}{" "}
          {change.replaces.map((at) => formatDateTime(at)).join("; ")}.
        </p>
      )}
      <p>
        Your {formatMoney(change.depositCents)} Deposit stays as it is, so
        nothing is charged now.
      </p>
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
  const [newCard, setNewCard] = useState(!paymentMethod);
  // what's bookable may have changed since the page loaded
  const action = useAction("That didn't work. Please try again.", {
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
            ? { paymentToken }
            : { serviceKey: chosen.serviceKey, paymentToken },
        );
        if (outcome.status === "needs_approval") {
          await payment.approve(outcome.secret);
          await postJson<AcceptOutcome>(
            `/api/quotes/mine/${quote.id}/accept/finalize`,
          );
        }
      },
      quote.plan ? "Your Service Plan has started" : "You're booked",
    );

  return (
    <Section
      title={
        quote.plan
          ? depositCents > 0
            ? "Pay and start your plan"
            : "Start your plan"
          : depositCents > 0
            ? "Pay and book"
            : "Book"
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
                Use your {paymentMethod.label}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CreditCard aria-hidden size={18} className="text-fg-muted" />
              Paying with your {paymentMethod?.label ?? "saved card"}
            </span>
            <Button variant="text" size="sm" onPress={() => setNewCard(true)}>
              Use a different card
            </Button>
          </div>
        )}

        <p className="text-sm text-fg-muted">
          {quote.plan
            ? `${depositCents > 0 ? `We take the ${formatMoney(depositCents)} Deposit now and hold it for as long as your plan runs: it comes off your last clean when the plan ends. ` : ""}${quote.plan.days.length === 1 ? `Each clean, ${formatMoney(chosen.totalCents)},` : "Each clean"} is charged when it's done. The first is on ${formatDateTime(quote.proposedStartsAt)}.`
            : `${
                chosen.depositCents > 0
                  ? `We take the ${formatMoney(chosen.depositCents)} Deposit now and the rest, ${formatMoney(balance)}, when the clean is done.`
                  : `Nothing is taken now: the ${formatMoney(chosen.totalCents)} is charged when the clean is done.`
              } Booked for ${formatDateTime(quote.proposedStartsAt)}.`}
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
              ? `Accept and pay ${formatMoney(depositCents)}`
              : "Accept and book"}
          </Button>
        </Actions>
      </Card>
    </Section>
  );
}

// accepting a Quote that changes the home's plan: nothing to pay, as the
// plan's Deposit carries over
function AcceptChange({ quote }: { quote: QuoteView }) {
  const action = useAction("That didn't work. Please try again.", {
    reloadOnFailure: true,
  });
  const [only, ...others] = quote.options;

  const accept = () =>
    action.run(
      () => postJson<AcceptOutcome>(`/api/quotes/mine/${quote.id}/accept`, {}),
      "Your Service Plan has changed",
    );

  return (
    <Section title="Accept the new terms">
      <Card>
        <p className="text-sm text-fg-muted">
          Nothing is charged now. Each clean
          {others.length === 0 ? `, ${formatMoney(only!.totalCents)},` : ""} is
          charged when it's done, from {formatDateTime(quote.proposedStartsAt)}.
        </p>
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Decline quote={quote} />
          <Button isPending={action.isPending} onPress={() => void accept()}>
            Accept the new terms
          </Button>
        </Actions>
      </Card>
    </Section>
  );
}

// beside accepting, quietly: they're asked once more before it's done
function Decline({ quote }: { quote: QuoteView }) {
  const action = useAction("That didn't work. Please try again.");

  const decline = async (close: () => void) => {
    const ok = await action.run(
      () => postJson(`/api/quotes/mine/${quote.id}/decline`),
      "Quote declined",
    );
    if (ok) close();
  };

  return (
    <DialogTrigger>
      <Button variant="text">Decline this Quote</Button>
      <Dialog title="Decline this Quote?" role="alertdialog">
        {({ close }) => (
          <>
            <p>
              We'll let the team know you're not going ahead. You can ask for a
              new Quote whenever you like.
            </p>
            {action.problem && <Notice tone="danger">{action.problem}</Notice>}
            <Actions>
              <Button variant="quiet" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={action.isPending}
                onPress={() => void decline(close)}
              >
                Decline
              </Button>
            </Actions>
          </>
        )}
      </Dialog>
    </DialogTrigger>
  );
}
