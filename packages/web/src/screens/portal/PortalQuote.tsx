import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import type { QuoteView } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Heading,
  Notice,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { addressOf, formatDateTime } from "../format.ts";
import { AddOnList, OptionCard, QuoteStatusBadge } from "../QuoteParts.tsx";

// a Quote as its Client sees it, from the link in the Quote email
export function PortalQuote() {
  const quote = useLoaderData({ from: "/portal/quotes/$quoteId" });

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
          <Heading level={1}>Your Quote</Heading>
          <QuoteStatusBadge status={quote.status} />
        </div>
        <p className="text-fg-muted">{addressOf(quote.property)}</p>
      </div>

      <Standing quote={quote} />

      <section aria-labelledby="options-title" className="flex flex-col gap-4">
        <Heading level={2} id="options-title">
          Choose your clean
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

      {quote.status === "sent" && <Decline quote={quote} />}
    </div>
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
          Proposed for {proposed}. This Quote is open until {until}.
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
