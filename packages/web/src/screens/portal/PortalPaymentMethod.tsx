import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { Button, FormPage, FormPart, Notice } from "@empire-cleaning/ui";
import {
  asksTheClient,
  catalog,
  type BillSummary,
  type CardPayment,
  type CardRetried,
  type ClientPastJob,
  type Unpaid,
} from "@empire-cleaning/models";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { postJson } from "../../api.ts";
import { ConsentNote, useCardForm } from "./CardForm.tsx";
import { useSaid, type Said } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    notSaved: "Your card couldn't be saved. Please try again.",
    saved: "Card saved",
    // a payment the provider left processing: it may yet go either way
    goingThrough: "We tried your card. The payment is still going through.",
    savedGoingThrough:
      "Card saved. The payment we tried is still going through.",
    howUsed: "How your card is used",
    about:
      "We take a deposit from this card when you book. Each clean is charged to it when it's done, or goes on your weekly bill if you have one. If a payment didn't go through, saving a card here tries it again.",
    tryAgain: "Try this card again",
    forClean: (amount: string, day: string) =>
      `${amount} for your ${day} clean`,
    forBill: (amount: string, number: string) => `${amount} for bill ${number}`,
    tryOrSave: "Try it again, or save a different card below.",
    paid: "Paid.",
    took: (what: string, card: string) => `We took ${what} from your ${card}.`,
    saveBelow: "Save a card below and we'll try again.",
    saveNew: "Save a new card below and we'll try again.",
    isSaved: (card: string, day: string) =>
      `Your ${card} is saved (since ${day}).`,
    noneYet: "You haven't saved a card yet.",
    add: "Add a card",
    save: "Save card",
  },
  es: {
    notSaved: "No se pudo guardar su tarjeta. Vuelva a intentarlo.",
    saved: "Tarjeta guardada",
    goingThrough: "Intentamos con su tarjeta. El pago todavía está en proceso.",
    savedGoingThrough:
      "Tarjeta guardada. El pago que intentamos todavía está en proceso.",
    howUsed: "Cómo se usa su tarjeta",
    about:
      "Cobramos un depósito de esta tarjeta cuando reserva. Cada limpieza se cobra a ella cuando está terminada, o va en su factura semanal si tiene una. Si un pago no pasó, guardar una tarjeta aquí lo vuelve a intentar.",
    tryAgain: "Volver a intentar con esta tarjeta",
    forClean: (amount: string, day: string) =>
      `${amount} por su limpieza del ${day}`,
    forBill: (amount: string, number: string) =>
      `${amount} por la factura ${number}`,
    tryOrSave: "Vuelva a intentarlo, o guarde otra tarjeta abajo.",
    paid: "Pagado.",
    took: (what: string, card: string) => `Cobramos ${what} de su ${card}.`,
    saveBelow: "Guarde una tarjeta abajo y lo volveremos a intentar.",
    saveNew: "Guarde una tarjeta nueva abajo y lo volveremos a intentar.",
    isSaved: (card: string, day: string) =>
      `Su ${card} está guardada (desde el ${day}).`,
    noneYet: "Aún no ha guardado una tarjeta.",
    add: "Agregar una tarjeta",
    save: "Guardar tarjeta",
  },
});

// what the Client's card failed to take that's theirs to put right (#499):
// their Unpaid cleans, then their weekly Bills, each with why, and whether
// trying the same card again might take it (declined, not expired). One
// waiting on the payment service we try again ourselves, so it asks
// nothing of them
export type CardOwed = CardPayment & { why: string | null; retry: boolean };

const asks = (unpaid: Unpaid | null): unpaid is Unpaid =>
  unpaid !== null && asksTheClient(unpaid.kind);

const owedFor = (unpaid: Unpaid) => ({
  why: unpaid.why,
  retry: unpaid.kind === "declined",
});

export const cardOwes = (
  pastJobs: ClientPastJob[],
  bills: BillSummary[],
): CardOwed[] => [
  ...pastJobs.flatMap((j) =>
    asks(j.unpaid)
      ? [
          {
            kind: "clean" as const,
            id: j.id,
            cents: j.owedCents,
            startsAt: j.startsAt,
            ...owedFor(j.unpaid),
          },
        ]
      : [],
  ),
  // charged to their card automatically and due, and not one their bank
  // is asking them to approve on its page
  ...bills.flatMap((b) =>
    b.payment === "automatic" &&
    b.status === "due" &&
    asks(b.unpaid) &&
    b.paying?.status !== "approving"
      ? [
          {
            kind: "bill" as const,
            id: b.id,
            cents: b.totalCents,
            number: b.number,
            ...owedFor(b.unpaid),
          },
        ]
      : [],
  ),
];

// each one and its amount, in a list: "$50.46 for your Sun, Jan 4 clean and
// $329.89 for bill EC-000001"
const owedList = (t: Said & { w: (typeof words)["en"] }, owed: CardPayment[]) =>
  t.formatList(
    owed.map((o) =>
      o.kind === "clean"
        ? t.w.forClean(t.formatMoney(o.cents), t.dayOf(o.startsAt))
        : t.w.forBill(t.formatMoney(o.cents), o.number),
    ),
  );

// the payment service's reason, when every one failed for the same
const sharedWhy = (owed: CardOwed[]) => {
  const whys = new Set(owed.map((o) => o.why));
  return whys.size === 1 ? owed[0]!.why : null;
};

// where the Office's "add a card" email leads: the Client adds (or
// replaces) the card that Deposits and Balances are charged to. Where a
// clean couldn't be charged, they fix it here: try the same card again (the
// money may be there now; not an expired one), or save another, which tries
// it too. Once that takes all of it, it says so in place of the alert, from
// what the server says it took, never from the list emptying (a payment
// still going through leaves it too).
export function PortalPaymentMethod() {
  const t = useSaid(words);
  const { saved, unpaid } = useLoaderData({ from: "/portal/payment-method" });
  const card = useCardForm();
  const action = useAction(t.w.notSaved);
  // a form-less action: its problem is a Toast, never a Notice in this
  // one; the page reloads either way, as part may have been taken
  const retry = useAction(t.couldntRetry, {
    toast: true,
    reloadOnFailure: true,
  });
  // what their last press took, to say it's paid once nothing's left
  const [took, setTook] = useState<CardPayment[]>([]);
  const paid = unpaid.length === 0 && took.length > 0 ? took : null;
  const retries = saved !== null && unpaid.some((o) => o.retry);

  // everything their card failed to take, tried at once; a 409 says what
  // still didn't go through
  const tryAgain = () => {
    setTook([]);
    return retry.run(
      () => postJson<CardRetried>("/api/payments/mine/retry"),
      (tried) => {
        setTook(tried.took);
        return tried.goingThrough ? t.w.goingThrough : "";
      },
    );
  };

  const save = () => {
    setTook([]);
    return action.run(
      async () => {
        const tried = await card.save();
        card.reset();
        return tried;
      },
      (tried) => {
        setTook(tried.took);
        return tried.goingThrough ? t.w.savedGoingThrough : t.w.saved;
      },
    );
  };

  return (
    <FormPage
      trail={[
        { label: t.p.payments, href: linkTo({ to: "/portal/payments" }) },
        { label: t.p.yourCard },
      ]}
      title={t.p.yourCard}
      // one at a time: what to pay for, else what was just paid, else the
      // card they have
      alerts={[
        unpaid.length > 0
          ? {
              key: "unpaid",
              tone: "danger",
              action: retries && (
                <Button
                  variant="text"
                  isPending={retry.isPending}
                  onPress={() => void tryAgain()}
                >
                  {t.w.tryAgain}
                </Button>
              ),
              children: (
                <p>
                  <strong>{t.p.paymentNeeded}</strong>{" "}
                  {t.notTaken(
                    owedList(t, unpaid),
                    saved?.label ?? null,
                    sharedWhy(unpaid),
                  )}{" "}
                  {retries
                    ? t.w.tryOrSave
                    : saved
                      ? t.w.saveNew
                      : t.w.saveBelow}
                </p>
              ),
            }
          : paid && saved
            ? {
                key: "paid",
                tone: "success",
                children: (
                  <p>
                    <strong>{t.w.paid}</strong>{" "}
                    {t.w.took(owedList(t, paid), saved.label)}
                  </p>
                ),
              }
            : saved
              ? {
                  key: "saved",
                  tone: "success",
                  children: t.w.isSaved(
                    saved.label,
                    t.formatDate(saved.savedAt),
                  ),
                }
              : { key: "none", children: t.w.noneYet },
      ]}
      about={{
        label: t.w.howUsed,
        children: <p className="text-sm text-fg-muted">{t.w.about}</p>,
      }}
      // what saving agrees to, in view above the button
      end={
        <>
          <ConsentNote action="saving" />
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        </>
      }
      buttons={
        <Button
          isPending={action.isPending}
          isDisabled={!card.isReady}
          onPress={() => void save()}
        >
          {t.w.save}
        </Button>
      }
    >
      <FormPart title={saved ? t.p.differentCard : t.w.add}>
        {card.field}
      </FormPart>
    </FormPage>
  );
}
