import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { ButtonLink, type Alert, type PageAction } from "@empire-cleaning/ui";
import { ApiError } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { useShared, type Said } from "../words.ts";
import { usePaymentForm } from "./CardForm.tsx";

type NeedsApproval = { status: "needs_approval"; secret: string };

/**
 * A payment the Client's bank wants them to approve, on a clean's or a
 * Bill's page, where it's the next step (#534 Q7, layout A): Approve
 * payment asks our server to take it with their saved card, there for them
 * (`start`); their bank asks them, and `finish` tells the server how that
 * went. Not approved, nothing is taken and `refused` says so, for the
 * page's alert, until they press it again. `paid` is the toast, from what
 * the payment gave back.
 */
export function useApprovePayment<T>({
  needed,
  start,
  finish,
  paid,
}: {
  // whether the page has a payment to approve: its form loads only then
  needed: boolean;
  start: () => Promise<T | NeedsApproval>;
  finish: (approved: boolean) => Promise<T>;
  paid: (result: T) => string;
}) {
  const t = useShared();
  // their saved card: no card box, but their bank's check runs here
  const payment = usePaymentForm({ amountCents: 0, showCard: false, needed });
  // a page's next step: why it failed is a toast, and the page reloads to
  // what the server found
  const paying = useAction(t.p.didntWork, {
    toast: true,
    reloadOnFailure: true,
  });
  const [refused, setRefused] = useState(false);

  const pay = () =>
    paying.run(
      async () => {
        setRefused(false);
        try {
          return await payment.pay({
            start,
            finish: (no) => finish(!no),
          });
        } catch (e) {
          // turned down at their bank: not a failure, theirs to try again
          if (e instanceof ApiError && e.kind === "approve") {
            setRefused(true);
            return null;
          }
          throw e;
        }
      },
      (result) => (result === null ? "" : paid(result)),
    );

  const approve: PageAction = {
    label: t.APPROVE_PAYMENT,
    icon: ShieldCheck,
    isPending: paying.isPending,
    isDisabled: !payment.isReady,
    onAction: () => void pay(),
  };
  return { approve, refused };
}

// paying it with another card instead, on the card page, whose saving
// tries it again
export const otherCard = (t: Said): PageAction => ({
  label: t.p.differentCard,
  icon: CreditCard,
  href: linkTo({ to: "/portal/payment-method" }),
});

// Why the page's next step is Approve payment: amber, as it's theirs to
// do and not a failure. Once they've turned it down, that nothing was
// taken, with another card beside it. `more` follows, e.g. that a plan is
// paused.
export const approveAlert = (
  t: Said,
  {
    refused,
    card,
    more = "",
  }: { refused: boolean; card: string; more?: string },
): Alert => ({
  key: "approve",
  tone: "warning",
  action: refused && (
    <ButtonLink variant="text" href={linkTo({ to: "/portal/payment-method" })}>
      {t.p.differentCard}
    </ButtonLink>
  ),
  children: (
    <p>
      <strong>{refused ? t.p.notApproved : t.p.bankWants}</strong>{" "}
      {refused ? t.p.tryAgain : t.p.nothingYet(card)}
      {more}
    </p>
  ),
});
