import { useLoaderData } from "@tanstack/react-router";
import { asksTheClient, type BillView, catalog } from "@empire-cleaning/models";
import { CreditCard } from "lucide-react";
import {
  Actions,
  Button,
  ButtonLink,
  Dialog,
  Notice,
  RecordPage,
  type Alert,
  type DialogState,
  type PageAction,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { pausedPlans } from "../format.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  usePrintBill,
} from "../BillParts.tsx";
import { useBillPaymentForm } from "./CardForm.tsx";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    onItsWay: (amount: string) =>
      `Your bank payment of ${amount} is on its way.`,
    emailOnce: "We'll email you once it has.",
    // its due date is in the line under its total
    late: "This bill wasn't paid by its due date.",
    forBill: (amount: string) => `${amount} for this bill`,
    payOr: (fix: string) => `Please pay it, or ${fix}.`,
    bankOnWay: "Your bank payment is on its way",
    paid: "Thank you, your bill is paid",
    payThis: "Pay this bill",
    byCardOrBank: (amount: string) =>
      `${amount}, by card or from your bank account.`,
    pay: (amount: string) => `Pay ${amount}`,
  },
  es: {
    onItsWay: (amount: string) =>
      `Su pago bancario de ${amount} está en camino.`,
    emailOnce: "Le avisaremos por correo cuando se acredite.",
    late: "Esta factura no se pagó antes de su fecha de vencimiento.",
    forBill: (amount: string) => `${amount} de esta factura`,
    payOr: (fix: string) => `Páguela, o ${fix}.`,
    bankOnWay: "Su pago bancario está en camino",
    paid: "Gracias, su factura está pagada",
    payThis: "Pagar esta factura",
    byCardOrBank: (amount: string) =>
      `${amount}, con tarjeta o desde su cuenta bancaria.`,
    pay: (amount: string) => `Pagar ${amount}`,
  },
});

// one of the Client's weekly Bills (ADR-0016), a Record (docs/ux.md),
// where its emails lead: the whole Bill, which prints cleanly, and paying it
// here by card or bank debit while the server says it can be (`payable`),
// the page's next step (the `ui` skill), its form in a dialog so the page
// has one Pay; none while it's a payment of ours, which asks nothing of
// them (ADR-0022, #533). Its week is its Week fact (BillDetail)
export function PortalBill() {
  const t = useSaid(words);
  const bill = useLoaderData({ from: "/portal/bills/$billId" });
  const print = usePrintBill();
  const pay: PageAction | false = bill.payable && {
    label: t.w.payThis,
    icon: CreditCard,
    dialog: (state) => <PayBill bill={bill} {...state} />,
  };

  return (
    <>
      <BillLetterhead />
      <RecordPage
        trail={[
          { label: t.p.payments, href: linkTo({ to: "/portal/payments" }) },
          { label: t.p.bill(bill.number) },
        ]}
        title={t.p.bill(bill.number)}
        status={<BillStatusBadge bill={bill} />}
        next={pay || undefined}
        actions={[print]}
        alerts={[useStanding(bill)]}
        details={
          <BillDetail
            bill={bill}
            forClient
            jobHref={(jobId) =>
              linkTo({ to: "/portal/jobs/$jobId", params: { jobId } })
            }
          />
        }
      />
    </>
  );
}

// what's left to do about it, if anything; while it's unpaid, that a
// cleaning plan with cleans on it is paused, when one is
function useStanding(bill: BillView): Alert | null {
  const t = useSaid(words);
  const isPaused = pausedPlans(bill.plans).length > 0;
  const paused = isPaused ? ` ${t.noMoreCleans(true)}` : "";
  if (bill.status === "processing") {
    return {
      key: "processing",
      children: `${t.w.onItsWay(t.formatMoney(bill.totalCents))} ${t.BANK_CLEARING} ${t.w.emailOnce}`,
    };
  }
  if (bill.status !== "due") return null;
  if (bill.unpaid?.kind === "late") {
    return {
      key: "late",
      tone: "danger",
      children: `${t.w.late}${paused}`,
    };
  }
  if (bill.unpaid && !asksTheClient(bill.unpaid.kind)) {
    return {
      key: "unpaid",
      tone: "info",
      // as few words as Payments' card, in its words (#536)
      children: isPaused
        ? `${t.NOTHING_TO_DO} ${t.noMoreCleans(false)}`
        : t.NOTHING_TO_DO,
    };
  }
  if (bill.unpaid) {
    const { kind, why } = bill.unpaid;
    return {
      key: "unpaid",
      tone: "danger",
      children: (
        <>
          {t.notTaken(
            t.w.forBill(t.formatMoney(bill.totalCents)),
            kind === "no_card" ? null : t.p.card,
            why,
          )}{" "}
          {kind === "declined"
            ? t.w.payOr(t.UPDATE_AND_RETRY)
            : t.clientFix[kind]}
          {paused}
        </>
      ),
      action: (
        <ButtonLink
          variant="text"
          href={linkTo({ to: "/portal/payment-method" })}
        >
          {t.UPDATE_CARD}
        </ButtonLink>
      ),
    };
  }
  // a Bill simply due says so in its badge, and when by in the line under
  // its total
  return null;
}

// paying it here, by card or bank debit: a card pays at once, a bank debit
// is processing until it clears
function PayBill({ bill, ...state }: { bill: BillView } & DialogState) {
  const t = useSaid(words);
  return (
    <Dialog title={t.w.payThis} {...state}>
      {({ close }) => <PayForm bill={bill} close={close} />}
    </Dialog>
  );
}

// the dialog's content, rendered only while it's open: the payment starts
// then, and the provider's form mounts into a box that's on the page (one
// payment for the Bill however often it's opened: startBillPayment)
function PayForm({ bill, close }: { bill: BillView; close: () => void }) {
  const t = useSaid(words);
  const payment = useBillPaymentForm(bill.id);
  const action = useAction(t.p.didntWork);

  const pay = async () => {
    const ok = await action.run(
      async () => {
        const ref = await payment.pay();
        return postJson<BillView>(`/api/bills/mine/${bill.id}/payment`, {
          ref,
        }).catch((e: unknown) => {
          // the payment started is no good now: start afresh
          if (e instanceof ApiError && e.status === 409) payment.reset();
          throw e;
        });
      },
      (paid) => (paid.status === "processing" ? t.w.bankOnWay : t.w.paid),
    );
    if (ok) close();
  };

  return (
    <>
      <p>{t.w.byCardOrBank(t.formatMoney(bill.totalCents))}</p>
      {payment.field}
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          {t.p.cancel}
        </Button>
        <Button
          onPress={() => void pay()}
          isPending={action.isPending}
          isDisabled={!payment.isReady}
        >
          {t.w.pay(t.formatMoney(bill.totalCents))}
        </Button>
      </Actions>
    </>
  );
}
