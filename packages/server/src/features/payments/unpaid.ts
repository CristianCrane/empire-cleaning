import {
  catalog,
  type Language,
  type Unpaid,
  type UnpaidKind,
} from "@empire-cleaning/models";
import { NO_CARD, UNREACHABLE } from "./money.ts";

// Why a Job or a Bill is Unpaid, from the reason stored with it, in words a
// person reads (docs/ux.md, Words). The stored reason is the payment
// provider's code, or one of ours below, and stays as it is: open-payments.ts
// finds the payments it tries again by it.

// why a Job is Unpaid when settling it failed for want of anything the
// Client could fix
export const NOT_SETTLED = "its payment couldn't be worked out";
// why a Bill paid on its page is Unpaid
export const LATE = "not paid by its due date";

// ours, and the provider's own that we know: each with its kind. A bank
// asking for approval reads as a decline, as a new card is how they fix it
const known: Record<string, UnpaidKind> = {
  [UNREACHABLE]: "waiting",
  processing: "waiting",
  [NOT_SETTLED]: "waiting",
  [NO_CARD]: "no_card",
  [LATE]: "late",
  needs_approval: "declined",
};

// why, in words, in the reader's language (ADR-0025): ours, and the few
// declines worth naming; any other, the fraud-type ones too, is only
// "didn't go through", as the provider advises for what a customer sees
const whyWords = catalog({
  en: {
    [UNREACHABLE]: "we couldn't reach the payment service",
    processing: "the bank payment is still clearing",
    [NOT_SETTLED]: "something went wrong on our side",
    [NO_CARD]: "no card is saved",
    [LATE]: "it wasn't paid by its due date",
    needs_approval: "the bank asked for it to be approved first",
    expired_card: "the card has expired",
    insufficient_funds: "there wasn't enough money in the account",
    account_closed: "that bank account is closed",
    no_account: "that bank account is closed",
  },
  es: {
    [UNREACHABLE]: "no pudimos comunicarnos con el servicio de pagos",
    processing: "el pago bancario aún se está procesando",
    [NOT_SETTLED]: "algo salió mal de nuestra parte",
    [NO_CARD]: "no hay ninguna tarjeta guardada",
    [LATE]: "no se pagó antes de la fecha límite",
    needs_approval: "el banco pidió aprobarlo primero",
    expired_card: "la tarjeta venció",
    insufficient_funds: "no había suficiente dinero en la cuenta",
    account_closed: "esa cuenta bancaria está cerrada",
    no_account: "esa cuenta bancaria está cerrada",
  },
});

// what kind of failure it is, whatever the language
export const unpaidKind = (reason: string): UnpaidKind =>
  known[reason] ?? "declined";

export const whyNotPaid = (
  lang: Language,
  reason: string,
): Omit<Unpaid, "since"> => ({
  kind: unpaidKind(reason),
  why:
    reason in whyWords.en
      ? whyWords[lang][reason as keyof (typeof whyWords)["en"]]
      : null,
});

// whether a payment that failed is now the Client's to put right, and they
// haven't been told: before, it was paid (`before` null), or only waiting
// on the provider, which we try again ourselves
export const nowTheirs = (before: string | null, failure: string) =>
  unpaidKind(failure) !== "waiting" &&
  (before === null || unpaidKind(before) === "waiting");

// as a view shows it, in the reader's language
export const unpaidOf = (
  lang: Language,
  since: Date | null,
  reason: string | null,
) =>
  since
    ? { since: since.toISOString(), ...whyNotPaid(lang, reason ?? "") }
    : null;
