import {
  asksTheClient,
  catalog,
  type Language,
  type Unpaid,
  type UnpaidKind,
} from "@empire-cleaning/models";
import { APPROVE } from "../../services/payment-gateway/index.ts";
import { NO_CARD, NOT_APPROVED, UNREACHABLE } from "./money.ts";

// Why a Job or a Bill is Unpaid, from the reason stored with it, in words a
// person reads (docs/ux.md, Words). The stored reason is the payment
// provider's code, or one of ours below, and stays as it is: open-payments.ts
// finds the payments it tries again by it.

// why a Job is Unpaid when settling it failed for want of anything the
// Client could fix
export const NOT_SETTLED = "its payment couldn't be worked out";
// why a Bill paid on its page is Unpaid
export const LATE = "not paid by its due date";
// why a payment their bank wanted them to approve is still Unpaid, once they
// turned it down at their bank on its page: theirs to try again (#534's
// review F18), said by the server so every page and list agrees
export const REFUSED = "turned down at their bank";

// whether a payment their bank wanted them to approve was turned down there,
// on the Client's own word as their browser finished their bank's check
// (`finish`): they said so, or said approved and the payment ended not
// approved. Never one called off as they walked away, which the Clock does
// with no word from them: that still waits on their approval (#534's
// critical review C12)
export const turnedDown = (
  finish: "approved" | "refused",
  ended: { status: string; reason: string | null } | null | undefined,
) =>
  finish === "refused" ||
  (ended?.status === "failed" && NOT_APPROVED(ended.reason));

// ours, and the provider's own that we know: each with its kind. A bank
// asking for a charge made without the Client there to be approved is theirs
// to approve on its page (#534 Q7); its kind says so, so it has no "why"
const known: Record<string, UnpaidKind> = {
  [UNREACHABLE]: "waiting",
  processing: "waiting",
  [NOT_SETTLED]: "waiting",
  [NO_CARD]: "no_card",
  [LATE]: "late",
  [APPROVE]: "approve",
  [REFUSED]: "refused",
};

// why, in words, in the reader's language (ADR-0025): ours, and the few
// declines worth naming; any other, the fraud-type ones too, is only
// "didn't go through", as the provider advises for what a customer sees
const whyWords = catalog({
  en: {
    [UNREACHABLE]: "we couldn't reach the payment service",
    // a charge to the saved card the provider leaves processing (ADR-0022):
    // only a card is charged so, so no bank payment is clearing
    processing: "it's still being processed",
    [NOT_SETTLED]: "something went wrong on our side",
    [NO_CARD]: "no card is saved",
    [LATE]: "it wasn't paid by its due date",
    expired_card: "the card has expired",
    insufficient_funds: "there wasn't enough money in the account",
    account_closed: "that bank account is closed",
    no_account: "that bank account is closed",
  },
  es: {
    [UNREACHABLE]: "no pudimos comunicarnos con el servicio de pagos",
    processing: "se está procesando",
    [NOT_SETTLED]: "algo salió mal de nuestra parte",
    [NO_CARD]: "no hay ninguna tarjeta guardada",
    [LATE]: "no se pagó antes de la fecha límite",
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
