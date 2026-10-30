import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import type {
  AcceptOutcome,
  AskedQuoteView,
  ClientQuoteView,
  PaymentMethodView,
  PlanChange,
  QuoteView,
  ServicePlanTerms,
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
  Link,
  Notice,
  Radio,
  RadioGroup,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  addressOf,
  conditionLabel,
  formatDate,
  formatDateTime,
  formatMinutes,
  formatMoney,
  planRhythm,
  wantedCleaning,
} from "../format.ts";
import {
  AddOnList,
  OptionCard,
  PlanDayCard,
  PlanTotals,
  QuoteStatusBadge,
} from "../QuoteParts.tsx";
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
}: {
  quote: ClientQuoteView;
  title: string;
  updatedAt?: string | null;
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

// the offer: open, they accept or decline it here
function OfferedQuote({
  quote,
  paymentMethod,
}: {
  quote: QuoteView;
  paymentMethod: PaymentMethodView | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <QuoteHeader
        quote={quote}
        title={quote.plan ? "Your Service Plan Quote" : "Your Quote"}
        updatedAt={quote.updatedAt}
      />

      <Standing quote={quote} />
      {quote.changesPlan && quote.status === "sent" && (
        <PlanChangeNotice quote={quote} change={quote.changesPlan} />
      )}

      {quote.plan ? (
        <PlanOffer quote={quote} plan={quote.plan} />
      ) : (
        <OneOffOffer quote={quote} />
      )}

      {quote.status === "sent" && (
        <>
          {quote.bookable.length === 0 ? (
            // its day filled up after it was sent: nothing to pay for
            <Notice tone="info">
              Sorry,{" "}
              {quote.plan && quote.plan.days.length > 1
                ? "one of the days your plan starts on has"
                : `${formatDateTime(quote.proposedStartsAt)} has`}{" "}
              been fully booked since we sent this Quote, so it can't be
              accepted. We've let our team know, and we'll send you a new Quote
              for another time.
            </Notice>
          ) : quote.changesPlan ? (
            <AcceptChange quote={quote} />
          ) : (
            <Accept quote={quote} paymentMethod={paymentMethod} />
          )}
          <Decline quote={quote} />
        </>
      )}
    </div>
  );
}

// a Service Plan Quote: each weekday's clean and its price, what each saves
// on a one-off, and the Deposit
function PlanOffer({
  quote,
  plan,
}: {
  quote: QuoteView;
  plan: ServicePlanTerms;
}) {
  return (
    <>
      <section aria-labelledby="plan-title" className="flex flex-col gap-4">
        <Heading level={2} id="plan-title">
          Your Service Plan
        </Heading>
        <p className="text-fg-muted">
          {planRhythm(plan)}
          {plan.days.length > 1 ? ", one clean a day" : ""}. Each clean is{" "}
          {plan.discountPercent}% off what it would cost as a one-off. Prices
          include tax.
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
        <Section title={plan.days.length > 1 ? "Each week" : "Deposit"}>
          <Card>
            <PlanTotals
              plan={plan}
              depositPercent={quote.depositPercent}
              change={quote.changesPlan}
            />
          </Card>
        </Section>
      </section>

      <Section
        title="Extras"
        description="Done on every clean, and included in the price above."
      >
        <Card>
          <AddOnList addOns={quote.addOns} />
        </Card>
      </Section>
    </>
  );
}

// a one-off Quote: its Service, after the one recommended for a first
// visit where that's offered too
function OneOffOffer({ quote }: { quote: QuoteView }) {
  const [recommended, own] = quote.options;
  const choosing = quote.options.length > 1;
  return (
    <>
      <section aria-labelledby="options-title" className="flex flex-col gap-4">
        <Heading level={2} id="options-title">
          {quote.status === "accepted"
            ? "Your clean"
            : choosing
              ? "Choose your clean"
              : "Your clean"}
        </Heading>
        <p className="text-fg-muted">
          {choosing &&
            `We recommend a ${recommended!.serviceName} for a first visit: it brings your home up to standard. A ${own!.serviceName} costs less. `}
          Prices include tax.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {quote.options.map((option) => (
            <OptionCard
              key={option.serviceKey}
              option={option}
              crewSize={quote.crewSize}
              depositPercent={quote.depositPercent}
            />
          ))}
        </div>
      </section>

      <Section title="Extras" description="Included in both prices above.">
        <Card>
          <AddOnList addOns={quote.addOns} />
        </Card>
      </Section>
    </>
  );
}

// when it's for, and whether it's still open
function Standing({ quote }: { quote: QuoteView }) {
  const proposed = formatDateTime(quote.proposedStartsAt);
  const until = formatDateTime(quote.expiresAt);
  switch (quote.status) {
    case "sent":
      return (
        <Notice tone="info">
          {quote.changesPlan
            ? "Your new terms start"
            : quote.plan
              ? "Starting"
              : "Proposed for"}{" "}
          {proposed}. This Quote is open until {until}.
        </Notice>
      );
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
          You're booked: a{" "}
          {
            quote.options.find((o) => o.serviceKey === quote.acceptedServiceKey)
              ?.serviceName
          }{" "}
          on {proposed}. You accepted this Quote on{" "}
          {formatDateTime(quote.acceptedAt!)}.
        </Notice>
      );
    case "declined":
      return (
        <Notice>
          You declined this Quote on {formatDateTime(quote.declinedAt!)}.
        </Notice>
      );
    case "expired":
      return <Notice>This Quote expired on {until}.</Notice>;
    default:
      // nothing else has an offer
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

// One step: choose the Service, enter a card (or keep the saved one), and
// accept. The Deposit is taken, saving a card entered now, and the Job
// booked, or none of it. If their bank wants them to approve the payment,
// that happens here too, then the booking is finished. A Service Plan Quote
// is accepted whole, with a clean on each of its weekdays, and starts the
// plan, whose Deposit is held for as long as it runs; or changes the home's
// plan, taking nothing, as its Deposit carries over.
function Accept({
  quote,
  paymentMethod,
}: {
  quote: QuoteView;
  paymentMethod: PaymentMethodView | null;
}) {
  // the recommended Service, unless only the other still fits
  const [serviceKey, setServiceKey] = useState(
    quote.options.find((o) => quote.bookable.includes(o.serviceKey))!
      .serviceKey,
  );
  const [newCard, setNewCard] = useState(!paymentMethod);
  // what's bookable may have changed since the page loaded
  const action = useAction("That didn't work. Please try again.", {
    reloadOnFailure: true,
  });
  const chosen = quote.options.find((o) => o.serviceKey === serviceKey)!;
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
          quote.plan ? { paymentToken } : { serviceKey, paymentToken },
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
      title={quote.plan ? "Accept and start your plan" : "Accept and book"}
    >
      <Card>
        {!quote.plan && (
          <RadioGroup
            label="Your clean"
            value={serviceKey}
            onChange={setServiceKey}
          >
            {quote.options.map((option) => (
              <Radio
                key={option.serviceKey}
                value={option.serviceKey}
                isDisabled={!quote.bookable.includes(option.serviceKey)}
                description={
                  quote.bookable.includes(option.serviceKey)
                    ? `${formatMoney(option.totalCents)}, with a ${formatMoney(option.depositCents)} Deposit today`
                    : "No longer fits on that day: it's been booked up since we sent this Quote"
                }
              >
                {option.serviceName}
                {option.recommended && " (recommended)"}
              </Radio>
            ))}
          </RadioGroup>
        )}

        {newCard ? (
          <div className="flex flex-col gap-2">
            {payment.field}
            {paymentMethod && (
              <Button
                variant="secondary"
                className="self-start"
                onPress={() => setNewCard(false)}
              >
                Use your {paymentMethod.label}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p>
              Paying with your{" "}
              <strong>{paymentMethod?.label ?? "saved card"}</strong>.
            </p>
            <Button
              variant="secondary"
              className="self-start"
              onPress={() => setNewCard(true)}
            >
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
          <Button isPending={action.isPending} onPress={() => void accept()}>
            Accept the new terms
          </Button>
        </Actions>
      </Card>
    </Section>
  );
}

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
      <Button variant="secondary" className="self-start">
        Decline this Quote
      </Button>
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
