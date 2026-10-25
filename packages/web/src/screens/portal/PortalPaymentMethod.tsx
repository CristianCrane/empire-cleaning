import { useState } from "react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  Notice,
  showToast,
} from "@empire-cleaning/ui";
import { ApiError } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { formatDate } from "../format.ts";
import { CardProblem, ConsentNote, useCardForm } from "./CardForm.tsx";

// where the Office's "add a Payment Method" email leads: the Client adds (or
// replaces) the card that Deposits and Balances are charged to
export function PortalPaymentMethod() {
  const saved = useLoaderData({ from: "/portal/payment-method" });
  const router = useRouter();
  const card = useCardForm();
  const [problem, setProblem] = useState<string>();
  const [isPending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    setProblem(undefined);
    try {
      await card.save();
      showToast({ tone: "success", title: "Card saved" });
      card.reset();
      await router.invalidate();
    } catch (e) {
      setProblem(
        e instanceof CardProblem || (e instanceof ApiError && e.status === 409)
          ? e.message
          : "Your card couldn't be saved. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Your details", href: linkTo({ to: "/portal/details" }) },
            { label: "Payment Method" },
          ]}
        />
        <Heading level={1}>Payment Method</Heading>
        <p className="text-fg-muted">
          We take a Deposit from this card when you book, and the rest when each
          clean is done. If a clean couldn't be charged, saving a card here
          tries it again.
        </p>
      </div>

      {saved ? (
        <Notice tone="success">
          Your {saved.label} is saved (since {formatDate(saved.savedAt)}).
        </Notice>
      ) : (
        <Notice>You haven't saved a card yet.</Notice>
      )}

      <Card title={saved ? "Use a different card" : "Add a card"}>
        {card.field}
        <ConsentNote action="saving" />
        {problem && <Notice tone="danger">{problem}</Notice>}
        <Actions>
          <Button
            isPending={isPending}
            isDisabled={!card.isReady}
            onPress={() => void save()}
          >
            Save card
          </Button>
        </Actions>
      </Card>
    </div>
  );
}
