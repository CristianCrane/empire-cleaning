import {
  asksTheClient,
  catalog,
  formats,
  messages,
  type CardRetried,
} from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { ConflictError } from "../../middleware/errors.ts";
import { retryUnpaidBillsFor } from "../bills/bills.ts";
import { retryUnpaidJobsFor } from "../completion/completion.ts";
import {
  PROCESSING,
  stillNotPaid,
  unpaidKind,
  type CardTried,
} from "./unpaid.ts";

// Tries again everything a Client's saved Payment Method failed to take:
// their Unpaid Jobs, then their automatic Bills; says how each went
export const retryUnpaidFor = async (clientId: string) => [
  ...(await retryUnpaidJobsFor(clientId)),
  ...(await retryUnpaidBillsFor(clientId)),
];

// what trying them again took, as Your card says it: each payment taken in
// full, and whether the provider left any processing, which may yet go
// either way
export const tookOf = (retried: CardTried[]): CardRetried => ({
  took: retried
    .filter((r) => !r.failure && r.takenCents > 0)
    .map(({ takenCents, failure: _, ...paid }) => ({
      ...paid,
      cents: takenCents,
    })),
  goingThrough: retried.some((r) => r.failure === PROCESSING),
});

// what the API says to a Client trying their card again, in their language
// (ADR-0025)
const words = catalog({
  en: {
    differentCard: "You can save a different card below.",
    tookOnly: (amount: string, failed: string) =>
      `We took ${amount}, but not the rest. ${failed}`,
    nothingToTake:
      "Nothing was taken: it's paid, or its payment is still going through.",
  },
  es: {
    differentCard: "Puede guardar otra tarjeta abajo.",
    tookOnly: (amount: string, failed: string) =>
      `Cobramos ${amount}, pero no el resto. ${failed}`,
    nothingToTake:
      "No se cobró nada: ya está pagado, o su pago todavía está en proceso.",
  },
});

/**
 * The Client's "Try this card again" on Your card (#499): every payment
 * their card failed to take, its cleans and its weekly Bills, tried at once.
 * Resolves with what it took, and whether any is still going through, when
 * nothing failed; else a 409 says what happened, what was taken first. A
 * failure only the payment service's, which Your card doesn't show and we
 * try again ourselves, isn't theirs to read: it says to try later. One the
 * provider left processing isn't a failure: it may yet be taken.
 */
export const clientRetry = async (clientId: string) => {
  const retried = await retryUnpaidFor(clientId);
  const lang = currentLanguage();
  const said = words[lang];
  const result = tookOf(retried);
  const theirs = retried.find(
    (r) => r.failure && asksTheClient(unpaidKind(r.failure)),
  )?.failure;
  const failed = theirs
    ? `${stillNotPaid(lang, theirs)} ${said.differentCard}`
    : retried.some((r) => r.failure && r.failure !== PROCESSING)
      ? messages[lang].couldntRetry
      : null;
  if (!failed) {
    if (result.took.length > 0 || result.goingThrough) return result;
    throw new ConflictError(said.nothingToTake);
  }
  const takenCents = result.took.reduce((sum, p) => sum + p.cents, 0);
  throw new ConflictError(
    takenCents > 0
      ? said.tookOnly(formats[lang].formatMoney(takenCents), failed)
      : failed,
  );
};
