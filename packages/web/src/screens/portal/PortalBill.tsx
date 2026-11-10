import { useLoaderData } from "@tanstack/react-router";
import { type BillView, catalog } from "@empire-cleaning/models";
import {
  Actions,
  Breadcrumbs,
  Button,
  ButtonLink,
  Card,
  Section,
  Heading,
  Notice,
} from "@empire-cleaning/ui";
import { ApiError, postJson } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import {
  BillDetail,
  BillLetterhead,
  BillStatusBadge,
  PrintBill,
  billWeek,
} from "../BillParts.tsx";
import { useBillPaymentForm } from "./CardForm.tsx";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    bill: (n: string) => `Bill ${n}`,
    onItsWay: (amount: string) =>
      `Your bank payment of ${amount} is on its way.`,
    emailOnce: "We'll email you once it has.",
    wasDue: (day: string, amount: string) =>
      `This bill was due by ${day} and hasn't been paid. Please pay ${amount} below.`,
    forBill: (amount: string) => `${amount} for this bill`,
    card: "card",
    payBelow: (fix: string) => `Please pay it below, or ${fix}.`,
    pleasePay: (amount: string, day: string) =>
      `Please pay ${amount} by ${day}.`,
    didntWork: "That didn't work. Please try again.",
    bankOnWay: "Your bank payment is on its way",
    paid: "Thank you, your bill is paid",
    payThis: "Pay this bill",
    byCardOrBank: (amount: string) =>
      `${amount}, by card or from your bank account.`,
    pay: (amount: string) => `Pay ${amount}`,
  },
  es: {
    bill: (n: string) => `Factura ${n}`,
    onItsWay: (amount: string) =>
      `Su pago bancario de ${amount} está en camino.`,
    emailOnce: "Le avisaremos por correo cuando se acredite.",
    wasDue: (day: string, amount: string) =>
      `Esta factura vencía el ${day} y no se ha pagado. Pague ${amount} abajo.`,
    forBill: (amount: string) => `${amount} de esta factura`,
    card: "tarjeta",
    payBelow: (fix: string) => `Páguela abajo, o ${fix}.`,
    pleasePay: (amount: string, day: string) =>
      `Pague ${amount} antes del ${day}.`,
    didntWork: "No funcionó. Vuelva a intentarlo.",
    bankOnWay: "Su pago bancario está en camino",
    paid: "Gracias, su factura está pagada",
    payThis: "Pagar esta factura",
    byCardOrBank: (amount: string) =>
      `${amount}, con tarjeta o desde su cuenta bancaria.`,
    pay: (amount: string) => `Pagar ${amount}`,
  },
});

// one of the Client's weekly Bills (ADR-0016), where its emails lead: the
// whole Bill, which prints cleanly, and paying it here by card or bank debit
// while it's due
export function PortalBill() {
  const t = useSaid(words);
  const bill = useLoaderData({ from: "/portal/bills/$billId" });

  return (
    <div className="flex flex-col gap-6">
      <BillLetterhead />
      <div className="flex flex-col gap-4">
        <div className="print:hidden">
          <Breadcrumbs
            trail={[
              { label: t.p.payments, href: linkTo({ to: "/portal/payments" }) },
              { label: t.w.bill(bill.number) },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Heading level={1}>{t.w.bill(bill.number)}</Heading>
            <BillStatusBadge bill={bill} />
          </div>
          <div className="print:hidden">
            <PrintBill />
          </div>
        </div>
        <p className="text-fg-muted">{billWeek(t.lang, bill)}</p>
      </div>

      <Standing bill={bill} />
      {bill.payable && <PayBill bill={bill} />}
      <BillDetail
        bill={bill}
        forClient
        jobHref={(jobId) =>
          linkTo({ to: "/portal/jobs/$jobId", params: { jobId } })
        }
      />
    </div>
  );
}

// what's left to do about it, if anything
function Standing({ bill }: { bill: BillView }) {
  const t = useSaid(words);
  if (bill.status === "processing") {
    return (
      <Notice tone="info">
        {t.w.onItsWay(t.formatMoney(bill.totalCents))} {t.BANK_CLEARING}{" "}
        {t.w.emailOnce}
      </Notice>
    );
  }
  if (bill.status !== "due") return null;
  if (bill.unpaid?.kind === "late") {
    return (
      <Notice tone="danger">
        {t.w.wasDue(t.formatDay(bill.dueOn), t.formatMoney(bill.totalCents))}{" "}
        {t.PLAN_PAUSED}
      </Notice>
    );
  }
  if (bill.unpaid) {
    const { kind, why } = bill.unpaid;
    return (
      <div className="flex flex-col gap-3 print:hidden">
        <Notice tone="danger">
          {t.notTaken(
            t.w.forBill(t.formatMoney(bill.totalCents)),
            kind === "no_card" ? null : t.w.card,
            why,
          )}{" "}
          {kind === "declined"
            ? t.w.payBelow(t.UPDATE_AND_RETRY)
            : t.clientFix[kind]}
        </Notice>
        {kind !== "waiting" && (
          <Actions>
            <ButtonLink
              variant="secondary"
              href={linkTo({ to: "/portal/payment-method" })}
            >
              {t.UPDATE_CARD}
            </ButtonLink>
          </Actions>
        )}
      </div>
    );
  }
  return bill.payment === "on_page" && bill.totalCents > 0 ? (
    <Notice tone="warning">
      {t.w.pleasePay(t.formatMoney(bill.totalCents), t.formatDay(bill.dueOn))}
    </Notice>
  ) : null;
}

// paying it here, by card or bank debit: a card pays at once, a bank debit
// is processing until it clears
function PayBill({ bill }: { bill: BillView }) {
  const t = useSaid(words);
  const payment = useBillPaymentForm(bill.id);
  const action = useAction(t.w.didntWork);

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
