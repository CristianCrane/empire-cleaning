import { useLoaderData } from "@tanstack/react-router";
import { type BillView, catalog } from "@empire-cleaning/models";
import {
  Actions,
  Button,
  ButtonLink,
  Card,
  Section,
  Notice,
  RecordPage,
  type Alert,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  usePrintBill,
  billWeek,
} from "../BillParts.tsx";
import { useBillPaymentForm } from "./CardForm.tsx";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    onItsWay: (amount: string) =>
      `Your bank payment of ${amount} is on its way.`,
    emailOnce: "We'll email you once it has.",
    wasDue: (day: string, amount: string) =>
      `This bill was due by ${day} and hasn't been paid. Please pay ${amount} below.`,
    forBill: (amount: string) => `${amount} for this bill`,
    payBelow: (fix: string) => `Please pay it below, or ${fix}.`,
    pleasePay: (amount: string, day: string) =>
      `Please pay ${amount} by ${day}.`,
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
    wasDue: (day: string, amount: string) =>
      `Esta factura vencía el ${day} y no se ha pagado. Pague ${amount} abajo.`,
    forBill: (amount: string) => `${amount} de esta factura`,
    payBelow: (fix: string) => `Páguela abajo, o ${fix}.`,
    pleasePay: (amount: string, day: string) =>
      `Pague ${amount} antes del ${day}.`,
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
// here by card or bank debit while it's due
export function PortalBill() {
  const t = useSaid(words);
  const bill = useLoaderData({ from: "/portal/bills/$billId" });
  const print = usePrintBill();

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
        subtitle={billWeek(t.lang, bill)}
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
      >
        {bill.payable && <PayBill bill={bill} />}
      </RecordPage>
    </>
  );
}

// what's left to do about it, if anything
function useStanding(bill: BillView): Alert | null {
  const t = useSaid(words);
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
      children: `${t.w.wasDue(t.formatDay(bill.dueOn), t.formatMoney(bill.totalCents))} ${t.PLAN_PAUSED}`,
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
            ? t.w.payBelow(t.UPDATE_AND_RETRY)
            : t.clientFix[kind]}
        </>
      ),
      action: kind !== "waiting" && (
        <ButtonLink
          variant="danger-text"
          href={linkTo({ to: "/portal/payment-method" })}
        >
          {t.UPDATE_CARD}
        </ButtonLink>
      ),
    };
  }
  return bill.payment === "on_page" && bill.totalCents > 0
    ? {
        key: "pay",
        tone: "warning",
        children: t.w.pleasePay(
          t.formatMoney(bill.totalCents),
          t.formatDay(bill.dueOn),
        ),
      }
    : null;
}

// paying it here, by card or bank debit: a card pays at once, a bank debit
// is processing until it clears
function PayBill({ bill }: { bill: BillView }) {
  const t = useSaid(words);
  const payment = useBillPaymentForm(bill.id);
  const action = useAction(t.p.didntWork);

  const pay = () =>
    action.run(
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

  return (
    <Section
      className="print:hidden"
      title={t.w.payThis}
      description={t.w.byCardOrBank(t.formatMoney(bill.totalCents))}
    >
      <Card>
        {payment.field}
        {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        <Actions>
          <Button
            onPress={() => void pay()}
            isPending={action.isPending}
            isDisabled={!payment.isReady}
          >
            {t.w.pay(t.formatMoney(bill.totalCents))}
          </Button>
        </Actions>
      </Card>
    </Section>
  );
}
