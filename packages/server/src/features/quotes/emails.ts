import type { BillPayment, Recurrence } from "@empire-cleaning/models";
import {
  button,
  cleanDetails,
  details,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import {
  ASK_AGAIN,
  billPaid,
  cleansPaid,
  ON_WEEKS_BILL,
  PRICES_INCLUDE_TAX,
  quoteEmailedTo,
  turnedDown,
  type PropertyKind,
  type TurnDownReason,
  formats,
  dayOf,
} from "@empire-cleaning/models";
import { accessButton } from "../jobs/emails.ts";
import { describePlan, recurrenceLabel } from "./plan-days.ts";

const { formatMoney, formatWhen, weekdayName } = formats.en;

// Every Quote email links to the Quote's page, with no sign-in power
// (ADR-0006): the same page shows the offer once it's Sent

// how a Client books again once their cleans are cancelled or their plan
// has ended
export const BOOK_ANOTHER =
  "To book another clean, ask us for a quote in your account.";

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
  subject: "We got your request for a quote",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Thanks for asking us for a quote for ${address}. ${quoteEmailedTo(email)}`,
    ),
    button("See your quote", `/portal/quotes/${quoteId}`),
    paragraph(NOT_YOU),
  ],
});

// an ask for a Quote the Client has open already for `where`, as the
// reply says it and the email to their own address
export const alreadyAsked = (
  why: "asked" | "sent",
  where: string,
  email: string | null,
) =>
  why === "sent"
    ? `We've already sent you a quote for ${where}. You'll find it in your account.`
    : `You've already asked us for a quote for ${where}. We'll email it to ${email} soon.`;

// an ask for a Property the Client has already, as the other kind
export const alreadyYours = (
  address: string,
  kind: PropertyKind,
  whose: "your" | "their",
) =>
  `${address} is already ${whose} ${kind === "commercial" ? "business" : "home"} with us.`;

const NOT_YOU =
  "If you didn't ask for a quote, you can ignore this email, or reply and let us know.";

// to the Client's own address, when an ask with their email can't go ahead
// at a Property they already have: the Guest who asked is told only what
// anyone would be, so the reply can't show what the Client has where (#243)
export const askClashEmail = ({
  name,
  email,
  address,
  kind,
  why,
}: {
  name: string;
  email: string;
  address: string;
  kind: "residential" | "commercial";
  why: "otherKind" | "asked" | "sent";
}): Email => ({
  subject: "About your request for a quote",
  blocks: [
    greeting(firstNameOf(name)),
    ...(why === "otherKind"
      ? [
          paragraph(
            `${alreadyYours(address, kind, "your")} Sign in and pick it from the list to ask about it.`,
          ),
          button("Ask for a quote", "/portal/request"),
        ]
      : [
          paragraph(alreadyAsked(why, address, email)),
          button("See your quotes", "/portal"),
        ]),
    paragraph(NOT_YOU),
  ],
});

// to the Office: someone asked for a Quote on the landing page or in the
// portal, and was told to expect it within a working day
export const quoteRequestedEmail = ({
  client,
  businessName,
  serviceName,
  regular,
  address,
  quoteId,
}: {
  client: string;
  businessName: string | null;
  serviceName: string;
  regular: boolean;
  address: string;
  quoteId: string;
}): Email => ({
  subject: `New quote request from ${client}`,
  blocks: [
    paragraph(
      `${client} asked for a quote. We told them to expect it within a working day.`,
    ),
    details([
      {
        label: "Client",
        value: businessName ? `${client}, ${businessName}` : client,
      },
      {
        label: "Service",
        value: regular ? `${serviceName}, with regular visits` : serviceName,
      },
      { label: "Where", value: address },
    ]),
    button("Open the quote", `/office/quotes/${quoteId}`),
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
      ? "A quote needs another time"
      : `${quotes.length} quotes need another time`,
  blocks: [
    paragraph(
      quotes.length === 1
        ? "Its time is now booked up, so the client can't accept it:"
        : "Their times are now booked up, so the clients can't accept them:",
    ),
    details(
      quotes.map((q) => ({
        label: q.client,
        value: `${q.address}, ${formatWhen(q.startsAt)}`,
      })),
    ),
    paragraph(
      "Send each one a new quote for another time. They're under Needs attention until you do.",
    ),
    button("Open Needs attention", "/office"),
  ],
});

export const turnDownEmail = ({
  name,
  address,
  quoteId,
  reason,
}: {
  name: string;
  address: string;
  quoteId: string;
  reason: TurnDownReason;
}): Email => ({
  subject: "About your quote from Empire Cleaning",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Thanks for asking us for a quote for ${address}. ${turnedDown(reason)}`,
    ),
    paragraph(ASK_AGAIN),
    button("See your quote", `/portal/quotes/${quoteId}`),
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
        `Your cleaning plan quote for ${address} ${ready}: a ${day!.serviceName} ${recurrenceLabel[plan.recurrence]}, starting ${starting}.`,
      ),
      paragraph(
        `${formatMoney(offer.options[0]!.totalCents)} a clean, which saves you ${formatMoney(day!.savingCents)} on the one-off price of ${formatMoney(day!.oneOffTotalCents)}.`,
      ),
    ];
  }
  return [
    paragraph(
      `Your cleaning plan quote for ${address} ${ready}: ${describePlan(
        plan.recurrence,
        plan.days.map((d) => ({ ...d, startsAt: new Date(d.startsAt!) })),
      )}, starting ${starting}.`,
    ),
    details(
      offer.options.map((option, i) => ({
        label: weekdayName(dayOf(new Date(plan.days[i]!.startsAt!))),
        value: formatMoney(option.totalCents),
      })),
    ),
    paragraph(
      `${formatMoney(plan.roundTotalCents)} a week, ${plan.discountPercent}% off the one-off prices.`,
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
    subject: `Your ${offer.plan ? "cleaning plan quote" : "quote"} from Empire Cleaning${revised ? " has been updated" : ""}`,
    blocks: [
      greeting(firstNameOf(name)),
      ...(offer.plan
        ? planOffer(address, offer, offer.plan, ready)
        : [
            paragraph(
              `Your quote for ${address} ${ready}, for ${formatWhen(new Date(offer.proposedStartsAt))}:`,
            ),
            details(
              offer.options.map((o) => ({
                label: `${o.serviceName}${o.recommended ? " (recommended)" : ""}`,
                value: formatMoney(o.totalCents),
              })),
            ),
          ]),
      paragraph(
        `${PRICES_INCLUDE_TAX} It's open until ${formatWhen(new Date(offer.expiresAt))}. To see all of it, sign in with this email address (${email}):`,
      ),
      button("See your quote", `/portal/quotes/${quoteId}`),
    ],
  };
};

// ---- accepting ----

// how the Client pays: the Payment Method that paid, by its label, and the
// weekly Bill their cleans go on (ADR-0016), or null when each is charged
// when it's done
export type PaidWith = {
  paymentMethod: string | null;
  weeklyBill: BillPayment | null;
};

// what a one-off Job costs and what accepting took for it
export type Paid = PaidWith & { depositCents: number; totalCents: number };

// a plan's cleans, one on each weekday, from the first
export type PlanCleans = {
  recurrence: Recurrence;
  cleans: { startsAt: Date; serviceName: string; totalCents: number }[];
};

const chargedTo = (paid: PaidWith) =>
  paid.paymentMethod ? `your ${paid.paymentMethod}` : "your card";

// a plan's weekdays, what each clean on them costs, and how it's paid
const planPrices = ({ cleans }: PlanCleans, paid: PaidWith, now = "") => {
  const each =
    cleans.length === 1
      ? formatMoney(cleans[0]!.totalCents)
      : cleans
          .map(
            (c) =>
              `${formatMoney(c.totalCents)} on ${weekdayName(dayOf(c.startsAt))}s`,
          )
          .join(", ");
  if (paid.weeklyBill) {
    return `Each clean is ${now}${each}. ${cleansPaid(paid.weeklyBill)}`;
  }
  return cleans.length === 1
    ? `Each clean is ${now}${each}, charged to ${chargedTo(paid)} when it's done.`
    : `Each clean is charged to ${chargedTo(paid)} when it's done: ${each}.`;
};

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
  paid: PaidWith & { depositCents: number };
}): Email => ({
  subject: "Your cleaning plan with Empire Cleaning has started",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Your cleaning plan has started: ${describePlan(plan.recurrence, plan.cleans, ` at ${address}`)}. The first is on ${formatWhen(plan.cleans[0]!.startsAt)}.`,
    ),
    paragraph(planPrices(plan, paid)),
    ...(paid.depositCents > 0
      ? [
          paragraph(
            `We've taken your deposit of ${formatMoney(paid.depositCents)}. We keep it while the plan runs, and it comes off your last clean when the plan ends.`,
          ),
        ]
      : []),
    paragraph(
      "We'll remind you the day before each clean. Please check we know how to get in:",
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
  paid: PaidWith;
}): Email => ({
  subject: "Your cleaning plan with Empire Cleaning has changed",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `Your cleaning plan at ${address} has changed: from ${formatWhen(plan.cleans[0]!.startsAt)}, it's ${describePlan(plan.recurrence, plan.cleans)}.`,
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
      "Your deposit stays as it is: we keep it while the plan runs, and it comes off your last clean when the plan ends.",
    ),
    button("See your cleaning plan", `/portal/plans/${planId}`),
  ],
});

// what was taken for a one-off Job, and how the rest is paid
const bookingPrice = (paid: Paid) => {
  const billed =
    paid.weeklyBill && `${ON_WEEKS_BILL}, ${billPaid[paid.weeklyBill]}`;
  return paid.depositCents > 0
    ? `We've taken your deposit of ${formatMoney(paid.depositCents)} from ${chargedTo(paid)}. The rest, ${formatMoney(paid.totalCents - paid.depositCents)}, ${billed || "is charged to it when the clean is done"}.`
    : `The ${formatMoney(paid.totalCents)} ${billed || `is charged to ${chargedTo(paid)} when the clean is done`}.`;
};

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
    paragraph(bookingPrice(paid)),
    paragraph(
      "We'll remind you the day before. Please check we know how to get in:",
    ),
    accessButton,
  ],
});
