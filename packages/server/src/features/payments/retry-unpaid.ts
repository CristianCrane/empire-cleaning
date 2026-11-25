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
import { WAITING_ON_PROVIDER } from "./money.ts";
import { stillNotPaid, unpaidKind, type CardTried } from "./unpaid.ts";

// Tries again everything a Client's saved Payment Method failed to take:
// their Unpaid Jobs, then their automatic Bills; says how each went
export const retryUnpaidFor = async (clientId: string) => [
  ...(await retryUnpaidJobsFor(clientId)),
  ...(await retryUnpaidBillsFor(clientId)),
];

// a failure the payment service left waiting: processing, or out of reach,
// which we try again ourselves (Payment pending), so it may yet be taken
// (critical review C10). Not one that failed on our side, which nothing
// tries again by itself (C12)
const ours = (r: CardTried) =>
  !r.errored && r.failure !== null && WAITING_ON_PROVIDER.includes(r.failure);

// what trying them again took, as Your card says it: each payment's money
// taken, the rest of one failing included (critical review C11), and
// whether any is still to come by us
export const tookOf = (retried: CardTried[]): CardRetried => ({
  took: retried
    .filter((r) => r.takenCents > 0)
    .map(({ takenCents, failure: _, ...paid }) => ({
      ...paid,
      cents: takenCents,
    })),
  goingThrough: retried.some(ours),
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
 * nothing failed that's theirs to put right; else a 409 says what
 * happened, what was taken first. One the payment service left processing
 * or couldn't be reached for isn't theirs: we try it again ourselves, so it
 * answers as still going through, as saving a card does (critical review
 * C10). One that failed on our side says to try later (C12).
 */
export const clientRetry = async (clientId: string) => {
  const retried = await retryUnpaidFor(clientId);
  const lang = currentLanguage();
  const said = words[lang];
  const result = tookOf(retried);
  const theirs = retried.find(
    (r) => r.failure && asksTheClient(unpaidKind(r.failure)),
  )?.failure;
  // theirs to put right first, else one that failed on our side (C12)
  const failed = theirs
    ? `${stillNotPaid(lang, theirs)} ${said.differentCard}`
    : retried.some((r) => r.errored)
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
