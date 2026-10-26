import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import type {
  AcceptOutcome,
  CleanType,
  PaymentMethodView,
  QuoteView,
  ServicePlanTerms,
} from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  Link,
  Notice,
  Radio,
  RadioGroup,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import {
  addressOf,
  cleanTypeLabel,
  formatDateTime,
  formatMoney,
  recurrenceLabel,
} from "../format.ts";
import {
  AddOnList,
  OptionCard,
  PlanCard,
  QuoteStatusBadge,
} from "../QuoteParts.tsx";
import { CardProblem, ConsentNote, usePaymentForm } from "./CardForm.tsx";

// a Quote as its Client sees it, from the link in the Quote email: open, they
// accept it right here
export function PortalQuote() {
  const { quote, paymentMethod } = useLoaderData({
    from: "/portal/quotes/$quoteId",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Home", href: linkTo({ to: "/portal" }) },
            { label: "Your Quote" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1}>
            {quote.plan ? "Your Service Plan Quote" : "Your Quote"}
          </Heading>
          <QuoteStatusBadge status={quote.status} />
        </div>
        <p className="text-fg-muted">{addressOf(quote.property)}</p>
      </div>

      <Standing quote={quote} />

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
              Sorry, {formatDateTime(quote.proposedStartsAt)} has been fully
              booked since we sent this Quote, so it can't be accepted. We've
              let our team know, and we'll send you a new Quote for another
              time.
            </Notice>
          ) : (
            <Accept quote={quote} paymentMethod={paymentMethod} />
          )}
          <Decline quote={quote} />
        </>
      )}
    </div>
  );
}

// a Service Plan Quote: each clean's price, and what it saves on a one-off
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
          A {cleanTypeLabel[plan.cleanType]}{" "}
          {recurrenceLabel[plan.recurrence].toLowerCase()}, on the same day of
          the week as the first. Each clean is {plan.discountPercent}% off what
          it would cost as a one-off. Prices include tax.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <PlanCard
            option={quote.options[0]!}
            plan={plan}
            crewSize={quote.crewSize}
            depositPercent={quote.depositPercent}
          />
        </div>
      </section>

      <Card
        title="Extras"
        description="Done on every clean, and included in the price above."
      >
        <AddOnList addOns={quote.addOns} />
      </Card>
    </>
  );
}

// a one-off Quote: both Clean Types, the Deep Clean recommended
function OneOffOffer({ quote }: { quote: QuoteView }) {
  return (
    <>
      <section aria-labelledby="options-title" className="flex flex-col gap-4">
        <Heading level={2} id="options-title">
          {quote.status === "accepted" ? "Your clean" : "Choose your clean"}
        </Heading>
        <p className="text-fg-muted">
          We recommend a Deep Clean for a first visit: it brings your home up to
          standard. A Standard Clean costs less. Prices include tax.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {quote.options.map((option) => (
            <OptionCard
              key={option.cleanType}
              option={option}
              crewSize={quote.crewSize}
              depositPercent={quote.depositPercent}
            />
          ))}
        </div>
      </section>

      <Card title="Extras" description="Included in both prices above.">
        <AddOnList addOns={quote.addOns} />
      </Card>
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
          {quote.plan ? "Starting" : "Proposed for"} {proposed}. This Quote is
          open until {until}.
        </Notice>
      );
    case "accepted":
      return quote.servicePlanId ? (
        <Notice tone="success">
          Your Service Plan has started: its first clean is on {proposed}. You
          accepted this Quote on {formatDateTime(quote.acceptedAt!)}.{" "}
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
          You're booked: a {cleanTypeLabel[quote.acceptedCleanType!]} on{" "}
          {proposed}. You accepted this Quote on{" "}
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
      return (
        <Notice>We've sent you a newer Quote, which replaces this one.</Notice>
      );
  }
}

// One step: choose the Clean Type, enter a card (or keep the saved one), and
// accept. The Deposit is taken, saving a card entered now, and the Job
// booked, or none of it. If their bank wants them to approve the payment,
// that happens here too, then the booking is finished. A Service Plan Quote
// has its one Clean Type, and accepting it starts the plan, whose Deposit is
// held for as long as it runs.
function Accept({
  quote,
  paymentMethod,
}: {
  quote: QuoteView;
  paymentMethod: PaymentMethodView | null;
}) {
  const router = useRouter();
  // the recommended Deep Clean, unless only the Standard Clean still fits
  const [cleanType, setCleanType] = useState<CleanType>(
    quote.bookable.includes("deep") ? "deep" : quote.bookable[0]!,
  );
  const [newCard, setNewCard] = useState(!paymentMethod);
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);
  const chosen = quote.options.find((o) => o.cleanType === cleanType)!;
  const balance = chosen.totalCents - chosen.depositCents;
  const payment = usePaymentForm({
    amountCents: chosen.depositCents,
    showCard: newCard,
  });

  const accept = async () => {
    setPending(true);
    setProblem(undefined);
    try {
      const paymentToken = newCard ? await payment.token() : undefined;
      const outcome = await postJson<AcceptOutcome>(
        `/api/quotes/mine/${quote.id}/accept`,
        { cleanType, paymentToken },
      );
      if (outcome.status === "needs_approval") {
        await payment.approve(outcome.secret);
        await postJson<AcceptOutcome>(
          `/api/quotes/mine/${quote.id}/accept/finalize`,
        );
      }
      showToast({
        tone: "success",
        title: quote.plan ? "Your Service Plan has started" : "You're booked",
      });
    } catch (e) {
      setProblem(
        e instanceof CardProblem || (e instanceof ApiError && e.status === 409)
          ? e.message
          : "That didn't work. Please try again.",
      );
    } finally {
      setPending(false);
      await router.invalidate();
    }
  };

  return (
    <Card title={quote.plan ? "Accept and start your plan" : "Accept and book"}>
      {!quote.plan && (
        <RadioGroup
          label="Your clean"
          value={cleanType}
          onChange={(value) => setCleanType(value as CleanType)}
        >
          {quote.options.map((option) => (
            <Radio
              key={option.cleanType}
              value={option.cleanType}
              isDisabled={!quote.bookable.includes(option.cleanType)}
              description={
                quote.bookable.includes(option.cleanType)
                  ? `${formatMoney(option.totalCents)}, with a ${formatMoney(option.depositCents)} Deposit today`
                  : "No longer fits on that day: it's been booked up since we sent this Quote"
              }
            >
              {cleanTypeLabel[option.cleanType]}
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
          ? `${chosen.depositCents > 0 ? `We take the ${formatMoney(chosen.depositCents)} Deposit now and hold it for as long as your plan runs: it comes off your last clean when the plan ends. ` : ""}Each clean, ${formatMoney(chosen.totalCents)}, is charged when it's done. The first is on ${formatDateTime(quote.proposedStartsAt)}.`
          : `${
              chosen.depositCents > 0
                ? `We take the ${formatMoney(chosen.depositCents)} Deposit now and the rest, ${formatMoney(balance)}, when the clean is done.`
                : `Nothing is taken now: the ${formatMoney(chosen.totalCents)} is charged when the clean is done.`
            } Booked for ${formatDateTime(quote.proposedStartsAt)}.`}
      </p>
      {newCard && <ConsentNote action="paying" />}
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Actions>
        <Button
          isPending={isPending}
          isDisabled={!payment.isReady}
          onPress={() => void accept()}
        >
          {chosen.depositCents > 0
            ? `Accept and pay ${formatMoney(chosen.depositCents)}`
            : "Accept and book"}
        </Button>
      </Actions>
    </Card>
  );
}

function Decline({ quote }: { quote: QuoteView }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

  const decline = async (close: () => void) => {
    setPending(true);
    setProblem(undefined);
    try {
      await postJson(`/api/quotes/mine/${quote.id}/decline`);
      showToast({ tone: "success", title: "Quote declined" });
      close();
      await router.invalidate();
    } catch (e) {
      setProblem(
        e instanceof ApiError && e.status === 409
          ? e.message
          : "That didn't work. Please try again.",
      );
    } finally {
      setPending(false);
    }
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
            {problem && <Notice tone="danger">{problem}</Notice>}
            <Actions>
              <Button variant="secondary" onPress={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                isPending={isPending}
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
