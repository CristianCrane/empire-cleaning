import type { Recurrence } from "@empire-cleaning/models";
import {
  button,
  cleanDetails,
  details,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import {
  firstNameOf,
  formatMoney,
  formatWhen,
  weekdayName,
} from "../../services/email/format.ts";
import { describePlan, recurrenceLabel } from "./plan-days.ts";

// Every Quote email links to the Quote's page, with no sign-in power
// (ADR-0006): the same page shows the offer once it's Sent

// always to the Client's own address, so an existing Client hears about any
// Quote asked for with their email
export const quoteReceivedEmail = ({
  name,
  email,
  address,
  quoteId,
}: {
  name: string;
  email: string;
  address: string;
  quoteId: string;
}): Email => ({
  subject: "We've received your request for a Quote",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Thanks for asking Empire Cleaning for a Quote for ${address}. We'll email your Quote to ${email}, usually within a working day.`,
    ),
    button("See your Quote", `/portal/quotes/${quoteId}`),
    paragraph(
      "If you didn't ask for a Quote, you can ignore this email, or reply and let us know.",
    ),
  ],
});

// to the Office: open Quotes a booking has left no room for
export const quotesWithoutRoomEmail = ({
  quotes,
}: {
  quotes: { client: string; address: string; startsAt: Date }[];
}): Email => ({
  subject:
    quotes.length === 1
      ? "A Quote needs another time"
      : `${quotes.length} Quotes need another time`,
  blocks: [
    paragraph(
      quotes.length === 1
        ? "A booking has filled the time this Quote was proposed for, so its Client can't accept it:"
        : "A booking has filled the time these Quotes were proposed for, so their Clients can't accept them:",
    ),
    details(
      quotes.map((q) => ({
        label: q.client,
        value: `${q.address}, ${formatWhen(q.startsAt)}`,
      })),
    ),
    paragraph(
      "Send each a new Quote for another time. They're under Needs attention until you do.",
    ),
    button("Open Needs attention", "/office"),
  ],
});

export const turnDownEmail = ({
  name,
  address,
  quoteId,
  why,
}: {
  name: string;
  address: string;
  quoteId: string;
  // "it's outside the area we clean"
  why: string;
}): Email => ({
  subject: "About your Quote from Empire Cleaning",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Thanks for asking Empire Cleaning for a Quote for ${address}. We're sorry, but we can't quote for it: ${why}.`,
    ),
    paragraph("If anything changes, you're welcome to ask us again."),
    button("See your Quote", `/portal/quotes/${quoteId}`),
  ],
});

// a Sent Revision, as much of it as the email shows
export type QuoteOffer = {
  number: number;
  proposedStartsAt: string;
  expiresAt: string;
  options: { serviceName: string; recommended: boolean; totalCents: number }[];
  plan: {
    recurrence: Recurrence;
    discountPercent: number;
    roundTotalCents: number;
    days: {
      serviceName: string;
      startsAt: string | null;
      savingCents: number;
      oneOffTotalCents: number;
    }[];
  } | null;
};

// a Service Plan Quote's offer: on one weekday, what each clean saves; on
// several, each weekday and what a week of them costs
const planOffer = (
  address: string,
  offer: QuoteOffer,
  plan: NonNullable<QuoteOffer["plan"]>,
  ready: string,
) => {
  const starting = formatWhen(new Date(offer.proposedStartsAt));
  if (plan.days.length === 1) {
    const [day] = plan.days;
    return [
      paragraph(
        `Your Service Plan Quote for ${address} ${ready}: a ${day!.serviceName} ${recurrenceLabel[plan.recurrence]}, starting ${starting}.`,
      ),
      paragraph(
        `${formatMoney(offer.options[0]!.totalCents)} a clean, saving ${formatMoney(day!.savingCents)} on the one-off price of ${formatMoney(day!.oneOffTotalCents)} (Plan Discount ${plan.discountPercent}%).`,
      ),
    ];
  }
  return [
    paragraph(
      `Your Service Plan Quote for ${address} ${ready}: ${describePlan(
        plan.recurrence,
        plan.days.map((d) => ({ ...d, startsAt: new Date(d.startsAt!) })),
      )}, starting ${starting}.`,
    ),
    details(
      offer.options.map((option, i) => ({
        label: weekdayName(new Date(plan.days[i]!.startsAt!)),
        value: formatMoney(option.totalCents),
      })),
    ),
    paragraph(
      `${formatMoney(plan.roundTotalCents)} a week, ${plan.discountPercent}% off the one-off prices (Plan Discount).`,
    ),
  ];
};

// A plain link to the Quote's page, not the Revision's, so a signed-out
// Client signs in (or up) with this email and comes back to it. A later
// Revision says the Quote has changed.
export const quoteEmail = ({
  name,
  email,
  quoteId,
  address,
  offer,
}: {
  name: string;
  email: string;
  quoteId: string;
  address: string;
  offer: QuoteOffer;
}): Email => {
  const revised = offer.number > 1;
  const ready = revised ? "has been updated" : "is ready";
  return {
    subject: `${revised ? "Your updated" : "Your"} ${offer.plan ? "Service Plan Quote" : "Quote"} from Empire Cleaning`,
    blocks: [
      greeting(firstNameOf(name)),
      ...(offer.plan
        ? planOffer(address, offer, offer.plan, ready)
        : [
            paragraph(
              `Your Quote for ${address} ${ready}, for ${formatWhen(new Date(offer.proposedStartsAt))}:`,
            ),
            details(
              offer.options.map((o) => ({
                label: `${o.serviceName}${o.recommended ? " (recommended)" : ""}`,
                value: formatMoney(o.totalCents),
              })),
            ),
          ]),
      paragraph(
        `Prices include tax. It's open until ${formatWhen(new Date(offer.expiresAt))}. To see it in full, sign in with this email address (${email}):`,
      ),
      button("See your Quote", `/portal/quotes/${quoteId}`),
    ],
  };
};

// ---- accepting ----

export type Paid = {
  depositCents: number;
  // a one-off Job's, or a plan's first clean's
  totalCents: number;
  paymentMethod: string | null;
};

// a plan's cleans, one on each weekday, from the first
export type PlanCleans = {
  recurrence: Recurrence;
  cleans: { startsAt: Date; serviceName: string; totalCents: number }[];
};

const chargedTo = (paid: Paid) =>
  paid.paymentMethod ? `your ${paid.paymentMethod}` : "your card";

// a plan's weekdays, and what each clean on them costs
const planPrices = ({ cleans }: PlanCleans, paid: Paid, now = "") =>
  cleans.length === 1
    ? `Each clean is ${now}${formatMoney(paid.totalCents)}, charged to ${chargedTo(paid)} when it's done.`
    : `Each clean is charged to ${chargedTo(paid)} when it's done: ${cleans
        .map(
          (c) => `${formatMoney(c.totalCents)} on ${weekdayName(c.startsAt)}s`,
        )
        .join(", ")}.`;

const accessButton = button(
  "Check your Access Instructions",
  "/portal/details",
);

// one email for the whole plan: its Jobs after the first get only the
// day-before reminder
export const planConfirmationEmail = ({
  name,
  address,
  plan,
  paid,
}: {
  name: string;
  address: string;
  plan: PlanCleans;
  paid: Paid;
}): Email => ({
  subject: "Your Service Plan with Empire Cleaning has started",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Your Service Plan has started: ${describePlan(plan.recurrence, plan.cleans, ` at ${address}`)}. The first is on ${formatWhen(plan.cleans[0]!.startsAt)}.`,
    ),
    paragraph(planPrices(plan, paid)),
    ...(paid.depositCents > 0
      ? [
          paragraph(
            `We've taken your Deposit of ${formatMoney(paid.depositCents)}. We hold it for as long as the plan runs, and it comes off your last clean when the plan ends.`,
          ),
        ]
      : []),
    paragraph(
      "We'll remind you the day before each clean. Please check your Access Instructions, so our team can get in:",
    ),
    accessButton,
  ],
});

// the plan's new terms, from the first Job on them, and the Jobs they
// replaced
export const planChangeEmail = ({
  name,
  address,
  planId,
  plan,
  replaced,
  paid,
}: {
  name: string;
  address: string;
  planId: string;
  plan: PlanCleans;
  replaced: Date[];
  paid: Paid;
}): Email => ({
  subject: "Your Service Plan with Empire Cleaning has changed",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Your Service Plan at ${address} has changed: from ${formatWhen(plan.cleans[0]!.startsAt)}, it's ${describePlan(plan.recurrence, plan.cleans)}.`,
    ),
    paragraph(
      `${planPrices(plan, paid, "now ")} Cleans before then go ahead as they were.`,
    ),
    ...(replaced.length > 0
      ? [
          paragraph(
            `The ${replaced.length === 1 ? "clean" : "cleans"} you had booked from then on (${replaced.map(formatWhen).join("; ")}) ${replaced.length === 1 ? "is" : "are"} cancelled, at no charge.`,
          ),
        ]
      : []),
    paragraph(
      "Your Deposit stays as it is: we hold it for as long as the plan runs, and it comes off your last clean when the plan ends.",
    ),
    button("See your Service Plan", `/portal/plans/${planId}`),
  ],
});

export const bookingConfirmationEmail = ({
  name,
  clean,
  paid,
}: {
  name: string;
  clean: Clean;
  paid: Paid;
}): Email => ({
  subject: "You're booked with Empire Cleaning",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("You're booked."),
    cleanDetails(clean),
    paragraph(
      paid.depositCents > 0
        ? `We've taken your Deposit of ${formatMoney(paid.depositCents)} from ${chargedTo(paid)}. The rest, ${formatMoney(paid.totalCents - paid.depositCents)}, is charged to it when the clean is done.`
        : `The ${formatMoney(paid.totalCents)} is charged to ${chargedTo(paid)} when the clean is done.`,
    ),
    paragraph(
      "We'll remind you the day before. Please check your Access Instructions, so our team can get in:",
    ),
    accessButton,
  ],
});
