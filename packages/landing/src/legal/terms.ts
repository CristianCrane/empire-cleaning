import {
  CANCELLATION_CUTOFF_HOURS as CUTOFF,
  messages,
} from "@empire-cleaning/models";
import { business } from "../business.ts";
import { deposit, moveOrCancel } from "../faqs.ts";
import type { LegalPage } from "./index.ts";

const said = messages.en;
const { phone, email } = business;

// how booking and paying work (#462), only as the app does it (GLOSSARY.md;
// ADR-0001, 0009, 0010, 0013, 0016). Where the site or the app already says
// a rule, it's their words, read from where they live (the FAQ's answers,
// models' messages), so a rule is worded once. The owner checks it on #206;
// it isn't legal advice. Its Spanish is terms.es.ts
export const terms: LegalPage = {
  key: "terms",
  effective: "2026-11-17",
  description:
    "How quotes, deposits, moving and cancelling a clean, fees, payments and refunds work at Empire Cleaning.",
  sections: [
    {
      title: "Quotes",
      text: [
        "Every quote is worked out for your home or business. We email it to you, and you accept it in your account. It says what's included, the price and how long it's open.",
        said.PRICES_INCLUDE_TAX,
        `A quote can't be accepted less than ${CUTOFF} hours before its time.`,
      ],
    },
    {
      title: "Your deposit",
      text: [
        deposit.answer,
        "Nothing is booked until the deposit is paid.",
        `You pay it by card. ${said.NEVER_SEE_CARD}`,
        `Paying saves your card. As the form says: “${said.cardConsent(true)}”`,
      ],
    },
    {
      title: "Price changes on the day",
      text: [
        "If the crew does an extra that wasn't on your quote, or the clean takes longer, we ask you to OK the price change in your account. Nothing more is charged unless you do.",
        "An extra on your quote that wasn't done comes off the price.",
      ],
    },
    {
      title: "Moving or cancelling a clean",
      text: [
        "You can do either from your account. A move waits for us to confirm the new time.",
        moveOrCancel,
        "A second late move of the same clean is a late cancellation: the deposit is kept as the fee, and the full price is charged when the clean is done.",
        "Cancelling in time refunds your deposit, and so does any clean we cancel.",
      ],
    },
    {
      title: "If we couldn't get in",
      text: [
        "If the crew can't get in, the clean doesn't happen, and it's charged as a late cancellation is: the deposit is kept as the couldn't-get-in fee.",
      ],
    },
    {
      title: "Cleaning plans",
      text: [
        "Once we've cleaned for you, or visited to see the place where a service needs it, you can have a cleaning plan, with visits every week, every 2 weeks or every 4 weeks, at the discount your quote shows. Each clean is charged when it's done. To change your plan, ask us for a new quote.",
        `Skipping a clean follows the rules for cancelling, but one we booked less than ${CUTOFF} hours before it is free to skip. Less than ${CUTOFF} hours before, or if we couldn't get in, there's a fee: that clean's share of your plan's deposit. Your deposit stays held.`,
        `You can end your plan whenever you like. Its cleans ${CUTOFF} hours or more away, and any we booked less than ${CUTOFF} hours before them, are cancelled for free; the others go ahead. Its deposit goes towards its last clean, and anything left over is refunded.`,
        `If we can't take a payment for your plan, we'll ask you to ${said.UPDATE_AND_RETRY}. ${said.PLAN_PAUSED}`,
      ],
    },
    {
      title: "Weekly bills for businesses",
      text: [
        "We can bill a business once a week instead: everything for the week, Monday to Sunday, goes on one bill made the following Monday. It's charged to your saved card, or, if we've agreed so, you pay it on its page by its due date, by card or from your US bank account.",
      ],
    },
    {
      title: "Refunds",
      text: [
        `What we owe you back, such as a deposit for a clean cancelled in time, goes back the way you paid it: to your card, or to your bank account for a weekly bill paid from it. ${said.REFUND_TAKES_DAYS}`,
      ],
    },
    {
      title: "Questions",
      text: [
        `Call us on ${phone.display} or email ${email.address}, and we'll help.`,
      ],
    },
  ],
};
