import { asksTheClient, catalog, formats } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import { ConflictError } from "../../middleware/errors.ts";
import { retryUnpaidBillsFor } from "../bills/bills.ts";
import { retryUnpaidJobsFor } from "../completion/completion.ts";
import { stillNotPaid, unpaidKind } from "./unpaid.ts";

// Tries again everything a Client's saved Payment Method failed to take:
// their Unpaid Jobs, then their automatic Bills; says how each went
export const retryUnpaidFor = async (clientId: string) => [
  ...(await retryUnpaidJobsFor(clientId)),
  ...(await retryUnpaidBillsFor(clientId)),
];

// what the API says to a Client trying their card again, in their language
// (ADR-0025)
const words = catalog({
  en: {
    differentCard: "You can save a different card below.",
    tookOnly: (amount: string, failed: string) =>
      `We took ${amount}, but not the rest. ${failed}`,
    couldntTry: "We couldn't try again. Please try later.",
    nothingToTake:
      "Nothing was taken: it's paid, or its payment is still going through.",
  },
  es: {
    differentCard: "Puede guardar otra tarjeta abajo.",
    tookOnly: (amount: string, failed: string) =>
      `Cobramos ${amount}, pero no el resto. ${failed}`,
    couldntTry: "No pudimos volver a intentarlo. Inténtelo más tarde.",
    nothingToTake:
      "No se cobró nada: ya está pagado, o su pago todavía está en proceso.",
  },
});

/**
 * The Client's "Try this card again" on Your card (#499): every payment
 * their card failed to take, its cleans and its weekly Bills, tried at once.
 * Resolves only when nothing failed and something was taken; else a 409
 * says what happened, what was taken first. A failure only the payment
 * service's, which Your card doesn't show and we try again ourselves, isn't
 * theirs to read: it says to try later.
 */
export const clientRetry = async (clientId: string) => {
  const retried = await retryUnpaidFor(clientId);
  const lang = currentLanguage();
  const said = words[lang];
  const takenCents = retried.reduce((sum, r) => sum + r.takenCents, 0);
  const theirs = retried.find(
    (r) => r.failure && asksTheClient(unpaidKind(r.failure)),
  )?.failure;
  const failed = theirs
    ? `${stillNotPaid(lang, theirs)} ${said.differentCard}`
    : retried.some((r) => r.failure)
      ? said.couldntTry
      : null;
  if (!failed) {
    if (takenCents > 0) return;
    throw new ConflictError(said.nothingToTake);
  }
  throw new ConflictError(
    takenCents > 0
      ? said.tookOnly(formats[lang].formatMoney(takenCents), failed)
      : failed,
  );
};
