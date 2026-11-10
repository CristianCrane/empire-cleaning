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
import { catalog } from "@empire-cleaning/models";
import { linkTo } from "../../links.ts";
import { useAction } from "../action.ts";
import { postJson } from "../../api.ts";
import { ConsentNote, useCardForm } from "./CardForm.tsx";
import { useSaid } from "../words.ts";

// in the Client's language (ADR-0025)
const words = catalog({
  en: {
    notSaved: "Your card couldn't be saved. Please try again.",
    couldntRetry: "We couldn't try again. Please try later.",
    taken: "Payment taken",
    saved: "Card saved",
    about:
      "We take a deposit from this card when you book. Each clean is charged to it when it's done, or goes on your weekly bill if you have one. If a payment didn't go through, saving a card here tries it again.",
    tryAgain: "Try this card again",
    forClean: (amount: string, day: string, more: number) =>
      `${amount} for your ${day} clean${more > 0 ? `, and ${more} more,` : ""}`,
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
    about:
      "Cobramos un depósito de esta tarjeta cuando reserva. Cada limpieza se cobra a ella cuando está terminada, o va en su factura semanal si tiene una. Si un pago no pasó, guardar una tarjeta aquí lo vuelve a intentar.",
    tryAgain: "Volver a intentar con esta tarjeta",
    forClean: (amount: string, day: string, more: number) =>
      `${amount} de su limpieza del ${day}${more > 0 ? `, y ${more} más,` : ""}`,
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
// money may be there now), or save another, which tries it too.
export function PortalPaymentMethod() {
  const t = useSaid(words);
  const { saved, unpaid } = useLoaderData({ from: "/portal/payment-method" });
  const card = useCardForm();
  const action = useAction(t.w.notSaved);
  const retry = useAction(t.w.couldntRetry);
  const [first] = unpaid;
  const owed = unpaid.reduce((sum, j) => sum + j.owedCents, 0);

  // each Unpaid clean in turn; the first that still fails says why
  const tryAgain = () =>
    retry.run(async () => {
      for (const job of unpaid) {
        await postJson(`/api/jobs/mine/${job.id}/balance/retry`);
      }
    }, t.w.taken);

  const save = () =>
    action.run(async () => {
      await card.save();
      card.reset();
    }, t.w.saved);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          trail={[
            { label: t.p.payments, href: linkTo({ to: "/portal/payments" }) },
            { label: t.p.yourCard },
          ]}
        />
        <Heading level={1}>{t.p.yourCard}</Heading>
        <p className="text-fg-muted">{t.w.about}</p>
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
                {t.w.tryAgain}
              </Button>
            )
          }
        >
          <p>
            <strong>{t.p.paymentNeeded}</strong>{" "}
            {t.notTaken(
              t.w.forClean(
                t.formatMoney(owed),
                t.shortDayOf(first.startsAt),
                unpaid.length - 1,
              ),
              saved?.label ?? null,
            )}{" "}
            {saved ? t.w.tryOrSave : t.w.saveBelow}
          </p>
          {retry.problem && <p>{retry.problem}</p>}
        </Notice>
      ) : saved ? (
        <Notice tone="success">
          {t.w.isSaved(saved.label, t.formatDate(saved.savedAt))}
        </Notice>
      ) : (
        <Notice>{t.w.noneYet}</Notice>
      )}

      <Section title={saved ? t.p.differentCard : t.w.add}>
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
              {t.w.save}
            </Button>
          </Actions>
        </Card>
      </Section>
    </div>
  );
}
