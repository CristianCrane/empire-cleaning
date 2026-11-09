import { useLoaderData } from "@tanstack/react-router";
import {
  Actions,
  Breadcrumbs,
  Button,
  Card,
  Section,
  Heading,
  Notice,
} from "@empire-cleaning/ui";
import { formats, messages } from "@empire-cleaning/models";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { postJson } from "../../api.ts";
import { dayOfInstant } from "../format.ts";
import { ConsentNote, useCardForm } from "./CardForm.tsx";

const { notTaken } = messages.en;

const { formatDate, formatMoney, formatShortDay } = formats.en;

// where the Office's "add a card" email leads: the Client adds (or
// replaces) the card that Deposits and Balances are charged to. Where a
// clean couldn't be charged, they fix it here: try the same card again (the
// money may be there now), or save another, which tries it too.
export function PortalPaymentMethod() {
  const { saved, unpaid } = useLoaderData({ from: "/portal/payment-method" });
  const card = useCardForm();
  const action = useAction("Your card couldn't be saved. Please try again.");
  const retry = useAction("We couldn't try again. Please try later.");
  const [first] = unpaid;
  const owed = unpaid.reduce((sum, j) => sum + j.owedCents, 0);

  // each Unpaid clean in turn; the first that still fails says why
  const tryAgain = () =>
    retry.run(async () => {
      for (const job of unpaid) {
        await postJson(`/api/jobs/mine/${job.id}/balance/retry`);
      }
    }, "Payment taken");

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
            { label: "Your card" },
          ]}
        />
        <Heading level={1}>Your card</Heading>
        <p className="text-fg-muted">
          We take a deposit from this card when you book. Each clean is charged
          to it when it's done, or goes on your weekly bill if you have one. If
          a payment didn't go through, saving a card here tries it again.
        </p>
      </div>

      {first ? (
        <Notice
          tone="danger"
          action={
            saved && (
              <Button
                variant="danger-text"
                isPending={retry.isPending}
                onPress={() => void tryAgain()}
              >
                Try this card again
              </Button>
            )
          }
        >
          <p>
            <strong>Payment needed.</strong>{" "}
            {notTaken(
              `${formatMoney(owed)} for your ${formatShortDay(dayOfInstant(first.startsAt))} clean${unpaid.length > 1 ? `, and ${unpaid.length - 1} more,` : ""}`,
              saved?.label ?? null,
            )}{" "}
            {saved
              ? "Try it again, or save a different card below."
              : "Save a card below and we'll try again."}
          </p>
          {retry.problem && <p>{retry.problem}</p>}
        </Notice>
      ) : saved ? (
        <Notice tone="success">
          Your {saved.label} is saved (since {formatDate(saved.savedAt)}).
        </Notice>
      ) : (
        <Notice>You haven't saved a card yet.</Notice>
      )}

      <Section title={saved ? "Use a different card" : "Add a card"}>
        <Card>
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
      </Section>
    </div>
  );
}
