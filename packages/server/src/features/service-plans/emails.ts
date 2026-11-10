import {
  CANCELLATION_CUTOFF_HOURS,
  catalog,
  type EndPlanTerms,
  type Language,
  formats,
  messages,
} from "@empire-cleaning/models";
import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf, oneStop } from "../../services/email/format.ts";
import type { Settled } from "../completion/balance.ts";
import { getInWords } from "../jobs/emails.ts";
import { cardOf } from "../payments/emails.ts";
import { bookAnother } from "../quotes/emails.ts";

const whenList = (lang: Language, times: string[]) =>
  times.map((t) => formats[lang].formatWhen(new Date(t))).join("; ");

const words = catalog({
  en: {
    booked: {
      subject: "Your next clean is booked",
      NEXT: "The next clean on your cleaning plan is booked.",
      freeToSkip: (hours: number) =>
        `It was booked less than ${hours} hours ahead, so you can skip it for free.`,
      SEE_CLEAN: "See your clean",
    },
    ended: {
      subject: "Your cleaning plan has ended",
      asked: (address: string) =>
        `We've ended your cleaning plan at ${address}, as you asked.`,
      cancelled: (when: string) =>
        `We've cancelled the cleans it had booked, free: ${when}.`,
      goingAhead: (when: string, hours: number) =>
        `Your clean on ${when} is less than ${hours} hours away, so it goes ahead.`,
      depositComesOff: (deposit: string, final: string) =>
        `Your ${deposit} deposit comes off the price of your clean on ${final}.`,
      depositGoesTowards: (deposit: string, final: string) =>
        `Your ${deposit} deposit goes towards your clean on ${final}.`,
      taken: (amount: string, card: string) =>
        `We've taken the ${amount} still to pay from your ${card}.`,
      BILLED:
        "Whatever your final clean still owes, or is owed, goes on your next weekly bill.",
      SEE_PLAN: "See your plan",
    },
  },
  es: {
    booked: {
      subject: "Su próxima limpieza está reservada",
      NEXT: "La próxima limpieza de su plan de limpieza está reservada.",
      freeToSkip: (hours: number) =>
        `Se reservó con menos de ${hours} horas de anticipación, así que puede saltarla gratis.`,
      SEE_CLEAN: "Ver su limpieza",
    },
    ended: {
      subject: "Su plan de limpieza finalizó",
      asked: (address: string) =>
        `Finalizamos su plan de limpieza en ${address}, como nos pidió.`,
      cancelled: (when: string) =>
        oneStop(
          `Cancelamos gratis las limpiezas que tenía reservadas: ${when}.`,
        ),
      goingAhead: (when: string, hours: number) =>
        `Su limpieza del ${when} es en menos de ${hours} horas, así que sigue en pie.`,
      depositComesOff: (deposit: string, final: string) =>
        oneStop(
          `Su depósito de ${deposit} se descuenta del precio de su limpieza del ${final}.`,
        ),
      depositGoesTowards: (deposit: string, final: string) =>
        oneStop(
          `Su depósito de ${deposit} se usa para pagar su limpieza del ${final}.`,
        ),
      taken: (amount: string, card: string) =>
        `Cobramos los ${amount} que faltaban a su ${card}.`,
      BILLED:
        "Lo que su última limpieza todavía deba, o se le deba, va en su próxima factura semanal.",
      SEE_PLAN: "Ver su plan",
    },
  },
});

// to the Client, when one of their plan's cleans is booked too late for the
// day-before reminder (#242)
export const planCleanBookedEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    freeToSkip,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    // booked less than 24 hours before it
    freeToSkip: boolean;
  },
): Email => {
  const w = words[lang].booked;
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.NEXT),
      cleanDetails(lang, clean),
      ...(freeToSkip
        ? [paragraph(w.freeToSkip(CANCELLATION_CUTOFF_HOURS))]
        : []),
      paragraph(`${getInWords[lang].CAN_GET_IN}.`),
      button(w.SEE_CLEAN, `/portal/jobs/${jobId}`),
    ],
  };
};

export const planEndedEmail = (
  lang: Language,
  {
    name,
    address,
    planId,
    terms,
    settled,
  }: {
    name: string;
    address: string;
    planId: string;
    terms: EndPlanTerms;
    settled: Settled;
  },
): Email => {
  const w = words[lang].ended;
  const { formatMoney, formatWhen } = formats[lang];
  const card = cardOf(lang, settled.paymentMethod);
  const final = formatWhen(new Date(terms.finalJob.startsAt));
  const deposit = formatMoney(terms.depositCents);
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      ...[
        w.asked(address),
        ...(terms.cancelled.length > 0
          ? [w.cancelled(whenList(lang, terms.cancelled))]
          : []),
        ...(terms.goingAhead.length > 0
          ? [
              w.goingAhead(
                whenList(lang, terms.goingAhead),
                CANCELLATION_CUTOFF_HOURS,
              ),
            ]
          : []),
        // refunded, it's said below
        ...(terms.depositCents > 0 && terms.deposit !== "refunded"
          ? terms.deposit === "comes_off"
            ? [w.depositComesOff(deposit, final)]
            : [w.depositGoesTowards(deposit, final)]
          : []),
        ...(settled.refundedCents > 0
          ? [
              messages[lang].refundedTo(
                formatMoney(settled.refundedCents),
                card,
              ),
            ]
          : []),
        ...(settled.chargedCents > 0
          ? [w.taken(formatMoney(settled.chargedCents), card)]
          : []),
        ...(settled.billed ? [w.BILLED] : []),
        bookAnother[lang],
      ].map(paragraph),
      button(w.SEE_PLAN, `/portal/plans/${planId}`),
    ],
  };
};

// the Office hears when a Client Ends their plan themselves
export const officePlanEndedEmail = ({
  client,
  address,
  planId,
  terms,
}: {
  client: string;
  address: string;
  planId: string;
  terms: Pick<EndPlanTerms, "cancelled" | "goingAhead">;
}): Email => ({
  lang: "en",
  subject: `${client} ended their cleaning plan`,
  blocks: [
    paragraph(`${client} has ended their cleaning plan at ${address}.`),
    paragraph(
      terms.cancelled.length > 0
        ? `Its ${terms.cancelled.length} booked ${terms.cancelled.length === 1 ? "job is" : "jobs are"} cancelled, free.`
        : `It had no jobs booked more than ${CANCELLATION_CUTOFF_HOURS} hours out.`,
    ),
    ...(terms.goingAhead.length > 0
      ? [paragraph(`Going ahead: ${whenList("en", terms.goingAhead)}.`)]
      : []),
    button("See the plan", `/office/service-plans/${planId}`),
  ],
});
