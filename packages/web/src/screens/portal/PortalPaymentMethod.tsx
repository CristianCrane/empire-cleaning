import { useLoaderData } from "@tanstack/react-router";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Heading,
  Notice,
} from "@empire-cleaning/ui";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { formatDate } from "../format.ts";
import { ConsentNote, useCardForm } from "./CardForm.tsx";

// where the Office's "add a Payment Method" email leads: the Client adds (or
// replaces) the card that Deposits and Balances are charged to
export function PortalPaymentMethod() {
  const saved = useLoaderData({ from: "/portal/payment-method" });
  const card = useCardForm();
  const action = useAction("Your card couldn't be saved. Please try again.");

  const save = () =>
    action.run(async () => {
      await card.save();
      card.reset();
    }, "Card saved");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: "Payments", href: linkTo({ to: "/portal/payments" }) },
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
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Button
            isPending={action.isPending}
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
