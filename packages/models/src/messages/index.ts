import { catalog } from "../language.ts";
import { assignments } from "./assignments.ts";
import { bills } from "./bills.ts";
import { cancellation } from "./cancellation.ts";
import { jobs } from "./jobs.ts";
import { payments } from "./payments.ts";
import { plans } from "./plans.ts";
import { quotes } from "./quotes.ts";
import { reschedule } from "./reschedule.ts";

// What the server and the screens both say, written once (docs/ux.md,
// Words): a file per subject. What a Guest, Client or Cleaner may read is in
// English and Spanish (ADR-0025), in one catalog picked by the reader's
// language, `messages[lang]`, or `messages.en` where only English is read
// yet. What only the Office reads stays English, beside it.

export const messages = catalog({
  en: {
    ...assignments.en,
    ...bills.en,
    ...cancellation.en,
    ...jobs.en,
    ...payments.en,
    ...plans.en,
    ...quotes.en,
    ...reschedule.en,
  },
  es: {
    ...assignments.es,
    ...bills.es,
    ...cancellation.es,
    ...jobs.es,
    ...payments.es,
    ...plans.es,
    ...quotes.es,
    ...reschedule.es,
  },
});

// the rules the words state, and the Office's own words
export { RELEASE_CUTOFF_HOURS } from "./assignments.ts";
export { cleansPaidForOffice, ON_THAT_WEEKS_BILL } from "./bills.ts";
export {
  CANCELLATION_CUTOFF_HOURS,
  cancelCostForOffice,
  type CancelCost,
  type OfficeCancelCost,
} from "./cancellation.ts";
export { ADD_HOURS, DAY_FULL, MORE_HOURS, NO_CREW, whyNoRoom } from "./jobs.ts";
export { officeFix } from "./payments.ts";
export { needsVisit, noEmailYet, notSeenYet } from "./quotes.ts";
export {
  LATE_RESCHEDULE_HOURS,
  moveCostForOffice,
  type MoveCost,
} from "./reschedule.ts";
export * from "./staff.ts";
