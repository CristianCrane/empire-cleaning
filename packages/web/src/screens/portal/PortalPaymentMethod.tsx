import { useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import {
  Button,
  FormPage,
  FormPart,
  Notice,
  type PageAction,
} from "@empire-cleaning/ui";
import {
  asksTheClient,
  catalog,
  type BillSummary,
  type CardPayment,
  type CardRetried,
  type ClientPastJob,
  type Unpaid,
} from "@empire-cleaning/models";
import { ApiError } from "../../api.ts";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { billApproval, jobApproval } from "./approve-payment.tsx";
import { ConsentNote, useCardForm, usePaymentForm } from "./CardForm.tsx";
import { useSaid, type Said } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    notSaved: "Your card couldn't be saved. Please try again.",
    taken: "Payment taken",
    saved: "Card saved",
    // one we try again ourselves, as Payments says it: Payment pending,
    // and nothing to do (#499's UX review U7)
    stillGoing: (what: string) => `Still going through: ${what}.`,
    howUsed: "How your card is used",
    about:
      "We take a deposit from this card when you book. Each clean is charged to it when it's done, or goes on your weekly bill if you have one. If a payment didn't go through, saving a card here tries it again.",
    tryAgain: "Try this card again",
    // leads the alert once that press took nothing, so it shows it ran
    // (#508's UX review U18)
    triedAgain: "We tried it again.",
    // what a payment was for, after its amount
    forClean: (day: string) => `for your ${day} clean`,
    forBill: (number: string) => `for bill ${number}`,
    // one they turned down at their bank: their card works (#534's UX
    // review U16)
    refused: (amount: string, what: string) =>
      `The ${amount} payment ${what} wasn't approved, so none of it was taken.`,
    // the payments after the first, each tried in turn (#534's critical
    // review C11)
    more: (n: number) =>
      n === 1
        ? "1 more payment comes after it."
        : `${n} more payments come after it.`,
    tryOrSave: "Try it again, or save a different card below.",
    paid: "Paid.",
    took: (what: string, card: string) => `We took ${what} from your ${card}.`,
    // the Bill's page makes the same promise (#499's UX review U10)
    saveBelow: "Save a card below and we'll try again straight away.",
    saveNew: "Save a new card below and we'll try again straight away.",
    isSaved: (card: string, day: string) =>
      `Your ${card} is saved (since ${day}).`,
    noneYet: "You haven't saved a card yet.",
    add: "Add a card",
    save: "Save card",
  },
  es: {
    notSaved: "No se pudo guardar su tarjeta. Vuelva a intentarlo.",
    taken: "Pago cobrado",
    saved: "Tarjeta guardada",
    stillGoing: (what: string) => `Todavía en proceso: ${what}.`,
    howUsed: "Cómo se usa su tarjeta",
    about:
      "Cobramos un depósito de esta tarjeta cuando reserva. Cada limpieza se cobra a ella cuando está terminada, o va en su factura semanal si tiene una. Si un pago no pasó, guardar una tarjeta aquí lo vuelve a intentar.",
    tryAgain: "Volver a intentar con esta tarjeta",
    triedAgain: "Lo volvimos a intentar.",
    forClean: (day: string) => `de su limpieza del ${day}`,
    forBill: (number: string) => `de la factura ${number}`,
    refused: (amount: string, what: string) =>
      `El pago de ${amount} ${what} no se aprobó, así que no se cobró nada.`,
    more: (n: number) =>
      n === 1 ? "Después sigue 1 pago más." : `Después siguen ${n} pagos más.`,
    tryOrSave: "Vuelva a intentarlo, o guarde otra tarjeta abajo.",
    paid: "Pagado.",
    took: (what: string, card: string) => `Cobramos ${what} de su ${card}.`,
    saveBelow: "Guarde una tarjeta abajo y lo volvemos a intentar enseguida.",
    saveNew:
      "Guarde una tarjeta nueva abajo y lo volvemos a intentar enseguida.",
    isSaved: (card: string, day: string) =>
      `Su ${card} está guardada (desde el ${day}).`,
    noneYet: "Aún no ha guardado una tarjeta.",
    add: "Agregar una tarjeta",
    save: "Guardar tarjeta",
  },
});

// what the Client's card failed to take that's theirs to put right (#499):
// their Unpaid cleans, then their weekly Bills charged to it, each with
// why; whether trying the same card again might take it (declined, or
// turned down at their bank, not expired); and whether it was turned down
// there (#534's UX review U16)
export type CardOwed = CardPayment & {
  why: string | null;
  retry: boolean;
  refused: boolean;
};

// one waiting on the payment service we try again ourselves, and one their
// bank wants them to approve is approved on its own page, where trying it
// here would only ask again (#534 Q7). One they turned down there is here:
// its "Use a different card" leads here, to try this card again or save
// another
const owes = (unpaid: Unpaid | null): unpaid is Unpaid =>
  unpaid !== null && asksTheClient(unpaid.kind) && unpaid.kind !== "approve";

const owedFor = (unpaid: Unpaid) => ({
  why: unpaid.why,
  retry: unpaid.kind === "declined" || unpaid.kind === "refused",
  refused: unpaid.kind === "refused",
});

export const cardOwes = (
  pastJobs: ClientPastJob[],
  bills: BillSummary[],
): CardOwed[] => [
  ...pastJobs.flatMap((j) =>
    owes(j.unpaid)
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
    owes(b.unpaid) &&
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

type Words = Said & { w: (typeof words)["en"] };

// what a payment was for: "for your Tue, Oct 20 clean", "for bill EC-000001"
const forOf = (t: Words, o: CardPayment) =>
  o.kind === "clean"
    ? t.w.forClean(t.shortDayOf(o.startsAt))
    : t.w.forBill(o.number);

// each one and its amount, in a list: "$50.46 for your Sun, Jan 4 clean and
// $329.89 for bill EC-000001"
const owedList = (t: Words, owed: CardPayment[]) =>
  t.formatList(owed.map((o) => `${t.formatMoney(o.cents)} ${forOf(t, o)}`));

// which one notice Your card shows: what's still owed, else how saving a
// card went, from what the server says it took (never from the list
// emptying, as a payment still going through leaves it too): Paid only
// once none of it is (#499's review F13), else the card they have
export const cardNotice = (
  unpaid: unknown[],
  tried: CardRetried | null,
): "owed" | "goingThrough" | "paid" | "card" =>
  unpaid.length > 0
    ? "owed"
    : tried && tried.goingThrough.length > 0
      ? "goingThrough"
      : tried && tried.took.length > 0
        ? "paid"
        : "card";

// where the Office's "add a card" email leads: the Client adds (or
// replaces) the card that Deposits, Balances and weekly Bills are charged
// to. Where a clean or a Bill couldn't be charged, they fix it here: try
// the same card again (the money may be there now; not an expired one), or
// save another, which tries them all, and the notice in place says what
// that took. Once they turned it down at their bank, trying again is the
// page's next step, as on its own page: their card works (#534's UX review
// U23).
export function PortalPaymentMethod() {
  const t = useSaid(words);
  const { saved, unpaid } = useLoaderData({ from: "/portal/payment-method" });
  const card = useCardForm();
  const action = useAction(t.w.notSaved);
  // a form-less action: its problem is a Toast, never a Notice in this
  // one, and the page reloads to what the server found, either way
  const retry = useAction(t.couldntRetry, {
    toast: true,
    reloadOnFailure: true,
  });
  // what the server says saving a card took, and what's still going
  // through (#499's review F20)
  const [tried, setTried] = useState<CardRetried | null>(null);
  // the payment the card was just tried for again and still didn't take:
  // its alert says so, as a toast fades and the page would look as it did
  // before the press (#508's UX review U18)
  const [triedFor, setTriedFor] = useState<string | null>(null);
  const shown = cardNotice(unpaid, tried);
  const [first] = unpaid;
  const refused = !!first?.refused;
  const retries = !!saved && !!first?.retry;
  // the saved card's payments, made with them here, which their bank may
  // want them to approve here too
  const approving = usePaymentForm({
    amountCents: 0,
    showCard: false,
    needed: retries,
  });

  // the first one, approved with their bank here if it asks (#534 critical
  // review C10): one per press, the next shown once the page reloads (C11,
  // in critical-review-payment-truth.md). What it took is the notice in
  // place, as saving a card's is: Paid, or Payment pending while it's still
  // going through (#508's review F26); with more to come, the next one's
  // notice takes its place, so a toast says it instead. Not taken, its
  // alert says it was tried again, in this page's words: the server's say
  // what fixes it on a clean's or a Bill's page (#508's UX review U17)
  const tryAgain = () => {
    setTried(null);
    setTriedFor(null);
    const it = first!;
    // whether it's taken, or still going through
    const took = async () => {
      if (it.kind === "clean") {
        const { start, finish } = jobApproval(it.id);
        const job = await approving.pay({ start, finish: (no) => finish(!no) });
        return !job.payment.unpaid;
      }
      const { start, finish } = billApproval(it.id);
      const bill = await approving.pay({ start, finish: (no) => finish(!no) });
      return bill.status === "paid";
    };
    // a card's answer, declined or not approved, is a 409; any other
    // failure is ours, and says so in a toast
    const answered = () =>
      took().catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 409) return "refused";
        throw e;
      });
    return retry.run(answered, (took) => {
      if (took === "refused") {
        setTriedFor(it.id);
        return "";
      }
      setTried(
        took
          ? { took: [it], goingThrough: [] }
          : { took: [], goingThrough: [it] },
      );
      if (unpaid.length === 1) return "";
      return took ? t.w.taken : t.paymentPending;
    });
  };

  const retryNext: PageAction | undefined =
    refused && retries
      ? {
          label: t.w.tryAgain,
          icon: ShieldCheck,
          isPending: retry.isPending,
          isDisabled: !approving.isReady,
          onAction: () => void tryAgain(),
        }
      : undefined;

  const save = () => {
    setTried(null);
    return action.run(
      async () => {
        const tried = await card.save();
        card.reset();
        return tried;
      },
      (answer) => {
        setTried(answer);
        return t.w.saved;
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
      // one at a time: what to pay for, else what saving a card just took,
      // else the card they have
      alerts={[
        shown === "owed" && first
          ? {
              key: "unpaid",
              tone: refused ? "warning" : "danger",
              // turned down at their bank, the page's next step instead
              action: retries && !refused && (
                <Button
                  variant="danger-text"
                  isPending={retry.isPending}
                  isDisabled={!approving.isReady}
                  onPress={() => void tryAgain()}
                >
                  {t.w.tryAgain}
                </Button>
              ),
              children: (
                <p>
                  <strong>{t.p.paymentNeeded}</strong>{" "}
                  {triedFor === first.id && `${t.w.triedAgain} `}
                  {refused
                    ? t.w.refused(t.formatMoney(first.cents), forOf(t, first))
                    : t.notTaken(
                        `${t.formatMoney(first.cents)} ${forOf(t, first)}`,
                        saved?.label ?? null,
                        first.why,
                      )}{" "}
                  {unpaid.length > 1 && `${t.w.more(unpaid.length - 1)} `}
                  {retries
                    ? t.w.tryOrSave
                    : saved
                      ? t.w.saveNew
                      : t.w.saveBelow}
                </p>
              ),
            }
          : shown === "goingThrough" && tried && saved
            ? {
                key: "going",
                children: (
                  <p>
                    <strong>{t.paymentPending}.</strong>{" "}
                    {tried.took.length > 0 &&
                      `${t.w.took(owedList(t, tried.took), saved.label)} `}
                    {t.w.stillGoing(owedList(t, tried.goingThrough))}{" "}
                    {t.NOTHING_TO_DO}
                  </p>
                ),
              }
            : shown === "paid" && tried && saved
              ? {
                  key: "paid",
                  tone: "success",
                  children: (
                    <p>
                      <strong>{t.w.paid}</strong>{" "}
                      {t.w.took(owedList(t, tried.took), saved.label)}
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
      next={retryNext}
      // what saving agrees to, in view above the button
      end={
        <>
          <ConsentNote action="saving" />
          {action.problem && <Notice tone="danger">{action.problem}</Notice>}
        </>
      }
      buttons={
        <Button
          // beside trying their card again, a different one is the lesser
          variant={retryNext ? "secondary" : "primary"}
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
