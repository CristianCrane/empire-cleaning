import { useLoaderData } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import {
  Button,
  FormPage,
  FormPart,
  Notice,
  type PageAction,
} from "@empire-cleaning/ui";
import { catalog } from "@empire-cleaning/models";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { jobApproval } from "./approve-payment.tsx";
import { ConsentNote, useCardForm, usePaymentForm } from "./CardForm.tsx";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    notSaved: "Your card couldn't be saved. Please try again.",
    couldntRetry: "We couldn't try again. Please try later.",
    taken: "Payment taken",
    saved: "Card saved",
    howUsed: "How your card is used",
    about:
      "We take a deposit from this card when you book. Each clean is charged to it when it's done, or goes on your weekly bill if you have one. If a payment didn't go through, saving a card here tries it again.",
    tryAgain: "Try this card again",
    forClean: (amount: string, day: string) =>
      `${amount} for your ${day} clean`,
    // one they turned down at their bank: their card works (#534's UX
    // review U16)
    refused: (amount: string, day: string) =>
      `The ${amount} payment for your ${day} clean wasn't approved, so none of it was taken.`,
    // the cleans after the first, each tried in turn (#534's critical
    // review C11)
    more: (n: number) =>
      n === 1
        ? "1 more clean comes after it."
        : `${n} more cleans come after it.`,
    tryOrSave: "Try it again, or save a different card below.",
    saveBelow: "Save a card below and we'll try again.",
    isSaved: (card: string, day: string) =>
      `Your ${card} is saved (since ${day}).`,
    noneYet: "You haven't saved a card yet.",
    add: "Add a card",
    save: "Save card",
  },
  es: {
    notSaved: "No se pudo guardar su tarjeta. Vuelva a intentarlo.",
    couldntRetry: "No pudimos volver a intentarlo. Inténtelo más tarde.",
    taken: "Pago cobrado",
    saved: "Tarjeta guardada",
    howUsed: "Cómo se usa su tarjeta",
    about:
      "Cobramos un depósito de esta tarjeta cuando reserva. Cada limpieza se cobra a ella cuando está terminada, o va en su factura semanal si tiene una. Si un pago no pasó, guardar una tarjeta aquí lo vuelve a intentar.",
    tryAgain: "Volver a intentar con esta tarjeta",
    forClean: (amount: string, day: string) =>
      `${amount} de su limpieza del ${day}`,
    refused: (amount: string, day: string) =>
      `El pago de ${amount} de su limpieza del ${day} no se aprobó, así que no se cobró nada.`,
    more: (n: number) =>
      n === 1
        ? "Después sigue 1 limpieza más."
        : `Después siguen ${n} limpiezas más.`,
    tryOrSave: "Vuelva a intentarlo, o guarde otra tarjeta abajo.",
    saveBelow: "Guarde una tarjeta abajo y lo volveremos a intentar.",
    isSaved: (card: string, day: string) =>
      `Su ${card} está guardada (desde el ${day}).`,
    noneYet: "Aún no ha guardado una tarjeta.",
    add: "Agregar una tarjeta",
    save: "Guardar tarjeta",
  },
});

// where the Office's "add a card" email leads: the Client adds (or
// replaces) the card that Deposits and Balances are charged to. Where a
// clean couldn't be charged, they fix it here: try the same card again (the
// money may be there now), or save another, which tries it too. Once they
// turned it down at their bank, trying again is the page's next step, as
// on its own page: their card works (#534's UX review U23).
export function PortalPaymentMethod() {
  const t = useSaid(words);
  const { saved, unpaid } = useLoaderData({ from: "/portal/payment-method" });
  const card = useCardForm();
  const action = useAction(t.w.notSaved);
  // a form-less action: its problem is a Toast, never a Notice in this
  // one, and the page reloads to what the server found, either way
  const retry = useAction(t.w.couldntRetry, {
    toast: true,
    reloadOnFailure: true,
  });
  const [first] = unpaid;
  // one they turned down at their bank is theirs to try again, amber, as
  // on its own page: nothing's wrong with the card (#534's UX review U16)
  const refused = first?.unpaid === "refused";
  // the saved card's payments, made with them here, which their bank may
  // want them to approve here too
  const approving = usePaymentForm({
    amountCents: 0,
    showCard: false,
    needed: !!saved && unpaid.length > 0,
  });

  // the first Unpaid clean, approved with their bank here if it asks
  // (#534 critical review C10): one per press, so its toast and its alert
  // speak of that one clean only, the next shown once the page reloads
  // (C11, in critical-review-payment-truth.md)
  const tryAgain = () =>
    retry.run(async () => {
      const { start, finish } = jobApproval(first!.id);
      await approving.pay({ start, finish: (refused) => finish(!refused) });
    }, t.w.taken);

  const retryNext: PageAction | undefined =
    refused && saved
      ? {
          label: t.w.tryAgain,
          icon: ShieldCheck,
          isPending: retry.isPending,
          isDisabled: !approving.isReady,
          onAction: () => void tryAgain(),
        }
      : undefined;

  const save = () =>
    action.run(async () => {
      await card.save();
      card.reset();
    }, t.w.saved);

  return (
    <FormPage
      trail={[
        { label: t.p.payments, href: linkTo({ to: "/portal/payments" }) },
        { label: t.p.yourCard },
      ]}
      title={t.p.yourCard}
      // one at a time: a clean to pay for, else the card they have
      alerts={[
        first
          ? {
              key: "unpaid",
              tone: refused ? "warning" : "danger",
              // turned down at their bank, the page's next step instead
              action: saved && !refused && (
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
                  {refused
                    ? t.w.refused(
                        t.formatMoney(first.owedCents),
                        t.shortDayOf(first.startsAt),
                      )
                    : t.notTaken(
                        t.w.forClean(
                          t.formatMoney(first.owedCents),
                          t.shortDayOf(first.startsAt),
                        ),
                        saved?.label ?? null,
                      )}{" "}
                  {unpaid.length > 1 && `${t.w.more(unpaid.length - 1)} `}
                  {saved ? t.w.tryOrSave : t.w.saveBelow}
                </p>
              ),
            }
          : saved
            ? {
                key: "saved",
                tone: "success",
                children: t.w.isSaved(saved.label, t.formatDate(saved.savedAt)),
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
