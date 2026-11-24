import { useLoaderData, useRouter } from "@tanstack/react-router";
import {
  asksTheClient,
  type BillPayOutcome,
  type BillView,
  catalog,
} from "@empire-cleaning/models";
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
import { postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { pausedPlans } from "../format.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  usePrintBill,
} from "../BillParts.tsx";
import { useWhilePaying } from "../paying.ts";
import { usePaymentForm } from "./CardForm.tsx";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    emailOnce: "We'll email you once it has.",
    // its due date is in the line under its total
    late: "This bill wasn't paid by its due date.",
    forBill: (amount: string) => `${amount} for this bill`,
    payOr: (fix: string) => `Please pay it, or ${fix}.`,
    // their bank asking them to approve it, as they come back to the page:
    // pressing Pay calls the first off (#534)
    approving:
      "Your bank hasn't approved your payment yet. Approve it in your bank's app, or press Pay this bill to start over: the first payment is called off, so you're only charged once.",
    bankOnWay: "Your bank payment is on its way",
    paid: "Thank you, your bill is paid",
    // the payment service hasn't said yet, so the page says Payment pending
    pending: "Your payment is pending",
    payThis: "Pay this bill",
    pay: (amount: string) => `Pay ${amount}`,
  },
  es: {
    emailOnce: "Le avisaremos por correo cuando se acredite.",
    late: "Esta factura no se pagó antes de su fecha de vencimiento.",
    forBill: (amount: string) => `${amount} de esta factura`,
    payOr: (fix: string) => `Páguela, o ${fix}.`,
    approving:
      "Su banco aún no ha aprobado su pago. Apruébelo en la aplicación de su banco, o pulse Pagar esta factura para empezar de nuevo: el primer pago se cancela, así que solo se le cobra una vez.",
    bankOnWay: "Su pago bancario está en camino",
    paid: "Gracias, su factura está pagada",
    pending: "Su pago está pendiente",
    payThis: "Pagar esta factura",
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
  const router = useRouter();
  const print = usePrintBill();
  // while their bank asks them to approve it, so the page tells it approved
  // or called off without a reload
  useWhilePaying(bill.paying?.status === "approving" ? bill.paying : null, () =>
    router.invalidate(),
  );
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
    // its badge says it's pending and the line under its total since
    // when; this says what it is, first, and how long it takes (#534's UX
    // review U2, U3)
    return {
      key: "processing",
      children: `${t.w.bankOnWay}. ${t.BANK_CLEARING} ${t.w.emailOnce}`,
    };
  }
  if (bill.status !== "due") return null;
  // theirs to do: approve it with their bank, or start over
  if (bill.paying?.status === "approving") {
    return {
      key: "approving",
      tone: "warning",
      children: `${t.w.approving}${bill.unpaid ? paused : ""}`,
    };
  }
  // their last payment here didn't go through: what to do is the dialog's
  // own words. Before the due date nothing is paused by it, so no plan line
  // (a plan another Bill paused is that Bill's to say); once late, the
  // badge and the line under the total say so, and the plan line follows
  if (bill.paying?.status === "failed") {
    return {
      key: "failed",
      tone: "danger",
      children: `${t.payingFailed(bill.paying.why)}. ${t.PAY_AGAIN}${bill.unpaid ? paused : ""}`,
    };
  }
  // their last one here they never approved with their bank: no failure,
  // as nothing was taken, but what became of it, in the dialog's words, to
  // one who left it and comes back (#534's UX review U12)
  if (bill.paying?.status === "notApproved" && !bill.unpaid) {
    return {
      key: "notApproved",
      tone: "info",
      children: `${t.NOT_APPROVED} ${t.PAY_AGAIN}`,
    };
  }
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

// the dialog's content, rendered only while it's open, so the provider's
// form mounts into a box that's on the page. A payment refused here took
// nothing: the dialog stays to try again, and the page beneath reads the
// refusal (reloadOnFailure). Each Pay is a payment of its own, and one
// their bank still asks them to approve is called off first (#534)
function PayForm({ bill, close }: { bill: BillView; close: () => void }) {
  const t = useSaid(words);
  const payment = usePaymentForm({
    amountCents: bill.totalCents,
    methods: "cardOrBank",
    saves: false,
  });
  const action = useAction(t.p.didntWork, { reloadOnFailure: true });

  const pay = async () => {
    const ok = await action.run(
      () =>
        payment.pay({
          start: async (token) => {
            const outcome = await postJson<BillPayOutcome>(
              `/api/bills/mine/${bill.id}/payment`,
              { token },
            );
            return outcome.status === "done" ? outcome.bill : outcome;
          },
          // the server calls one not approved off, or finds it taken
          finish: (refused) =>
            postJson<BillView>(`/api/bills/mine/${bill.id}/payment/finish`, {
              approved: !refused,
            }),
        }),
      (paid) =>
        paid.status === "paid"
          ? t.w.paid
          : paid.status === "processing"
            ? t.w.bankOnWay
            : t.w.pending,
    );
    if (ok) close();
  };

  return (
    <>
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
