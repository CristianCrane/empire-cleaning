import {
  asksTheClient,
  because,
  catalog,
  type CardPayment,
  type Language,
  type Unpaid,
  type UnpaidKind,
} from "@empire-cleaning/models";
import { NO_CARD, PROCESSING, UNREACHABLE } from "./money.ts";

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
  [PROCESSING]: "waiting",
  [NOT_SETTLED]: "waiting",
  [NO_CARD]: "no_card",
  [LATE]: "late",
  needs_approval: "declined",
  // trying an expired card again can't take it: a new card puts it right
  expired_card: "no_card",
};

// why, in words, in the reader's language (ADR-0025): ours, and the few
// declines worth naming; any other, the fraud-type ones too, is only
// "didn't go through", as the provider advises for what a customer sees
const whyWords = catalog({
  en: {
    [UNREACHABLE]: "we couldn't reach the payment service",
    // a charge to the saved card the provider leaves processing (ADR-0022):
    // only a card is charged so, so no bank payment is clearing
    [PROCESSING]: "it's still being processed",
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
    [PROCESSING]: "se está procesando",
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

// how trying a payment again went: what it took, and why not when it
// failed (a stored reason, as above)
export type Retried = { takenCents: number; failure: string | null };

// the same, for one of a Client's payments, as Your card names it
export type CardTried = CardPayment extends infer P
  ? P extends CardPayment
    ? Omit<P, "cents"> & Retried
    : never
  : never;

// what kind of failure it is, whatever the language
export const unpaidKind = (reason: string): UnpaidKind =>
  known[reason] ?? "declined";

// a payment tried again that failed again, as a sentence, whoever reads it
export const stillNotPaid = (lang: Language, reason: string) =>
  retryWords[lang].stillNot(because(whyNotPaid(lang, reason).why));

const retryWords = catalog({
  en: {
    stillNot: (because: string) =>
      `The payment still didn't go through${because}.`,
  },
  es: {
    stillNot: (because: string) => `El pago todavía no pasó${because}.`,
  },
});

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
  asksTheClient(unpaidKind(failure)) &&
  (before === null || !asksTheClient(unpaidKind(before)));

// as a view shows it, in the reader's language
export const unpaidOf = (
  lang: Language,
  since: Date | null,
  reason: string | null,
) =>
  since
    ? { since: since.toISOString(), ...whyNotPaid(lang, reason ?? "") }
    : null;
