import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import { jobsButton } from "../assignments/emails.ts";
import type { Settled } from "../completion/balance.ts";
import { bookAnother } from "../quotes/emails.ts";
import {
  cancelCostForOffice,
  catalog,
  ON_THAT_WEEKS_BILL,
  type Language,
  formats,
  messages,
} from "@empire-cleaning/models";
import { cardOf } from "../payments/emails.ts";
import { unpaidKind, whyNotPaid } from "../payments/unpaid.ts";

// the Office's
const { formatMoney } = formats.en;

const words = catalog({
  en: {
    SEE_CLEAN: "See your clean",
    ON_WEEKLY_BILL: "It goes on your weekly bill.",
    // the fee, as "We couldn't take it" says it
    IT: "it",
    chargedTo: (card: string) => `We've charged it to your ${card}.`,
    cancelled: {
      subject: "Your clean is cancelled",
      SKIPPED_SUBJECT: "Your clean is skipped",
      SORRY: "We're sorry, we've had to cancel your clean.",
      NOTHING: "You won't be charged anything for it.",
      SKIPPED: "We've skipped your clean, as you asked.",
      CANCELLED: "We've cancelled your clean, as you asked.",
    },
    noAccess: {
      subject: "We couldn't get in for your clean",
      came: (reason: string) =>
        `Our team came for your clean, but couldn't get in ("${reason}").`,
      NO_CHARGE: "There's no charge for it.",
      CHECK_NEXT: "Before your next clean, please check how we get in.",
      CHECK_FIRST: "Please check how we get in first.",
    },
  },
  es: {
    SEE_CLEAN: "Ver su limpieza",
    ON_WEEKLY_BILL: "Va en su factura semanal.",
    IT: "el cargo",
    chargedTo: (card: string) => `Lo cobramos a su ${card}.`,
    cancelled: {
      subject: "Su limpieza está cancelada",
      SKIPPED_SUBJECT: "Saltamos su limpieza",
      SORRY: "Lo sentimos, tuvimos que cancelar su limpieza.",
      NOTHING: "No se le cobrará nada por ella.",
      SKIPPED: "Saltamos su limpieza, como nos pidió.",
      CANCELLED: "Cancelamos su limpieza, como nos pidió.",
    },
    noAccess: {
      subject: "No pudimos entrar para su limpieza",
      came: (reason: string) =>
        `Nuestro equipo fue para su limpieza, pero no pudo entrar ("${reason}").`,
      NO_CHARGE: "No tiene ningún cargo.",
      CHECK_NEXT:
        "Antes de su próxima limpieza, por favor revise cómo entramos.",
      CHECK_FIRST: "Por favor, revise primero cómo entramos.",
    },
  },
});

// a fee that didn't go through, for the Office, and why
const feeNotPaid = (failure: string) => {
  const { why } = whyNotPaid("en", failure);
  return `The fee didn't go through${why ? ` (${why})` : ""}, so the job is unpaid.`;
};

// what was refunded, as a line for the Client
const refundLine = (lang: Language, settled: Settled) =>
  settled.refundedCents > 0
    ? [
        messages[lang].refundedTo(
          formats[lang].formatMoney(settled.refundedCents),
          cardOf(lang, settled.paymentMethod),
        ),
      ]
    : [];

// how taking a plan Job's fee went, as a line for the Client
const feeChargeLine = (lang: Language, settled: Settled) => {
  const w = words[lang];
  const { clientFix, notTaken, PLAN_PAUSED } = messages[lang];
  if (settled.billed) return [w.ON_WEEKLY_BILL];
  const card = cardOf(lang, settled.paymentMethod);
  if (settled.chargedCents > 0) return [w.chargedTo(card)];
  if (settled.failure) {
    return [
      `${notTaken(w.IT, card)} ${clientFix[unpaidKind(settled.failure)]}`,
      ...(settled.plan === "held" ? [PLAN_PAUSED] : []),
    ];
  }
  return [];
};

// where a plan Job's fee went, for the Office: charged now, or on the Bill
// for the week the Job was in (ADR-0016), which needn't be the next one made
const feeTaken = (settled: Settled) =>
  settled.billed ? ON_THAT_WEEKS_BILL : "is charged";

const portalButton = (lang: Language, jobId: string) =>
  button(words[lang].SEE_CLEAN, `/portal/jobs/${jobId}`);
const officeButton = (jobId: string) =>
  button("See the job", `/office/jobs/${jobId}`);

export type Cancelled = {
  name: string;
  jobId: string;
  clean: Clean;
  // the Client cancelled it, or skipped it on a plan, or Empire Cleaning did
  // with a reason
  by: "client" | "empire";
  reason: string | null;
  onPlan: boolean;
  late: boolean;
  feeCents: number;
  settled: Settled;
};

// the Office's reason, if they gave one, as they wrote it
export const cancelledEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    by,
    reason,
    onPlan,
    late,
    feeCents: fee,
    settled,
  }: Cancelled,
): Email => {
  const w = words[lang].cancelled;
  const { cancelCostForClient, PLAN_CARRIES_ON } = messages[lang];
  const lines =
    by === "empire"
      ? [`${w.SORRY}${reason ? ` ${reason}` : ""}`, w.NOTHING]
      : [
          onPlan ? w.SKIPPED : w.CANCELLED,
          cancelCostForClient({
            onPlan,
            late,
            feeCents: fee,
            fee: formats[lang].formatMoney(fee),
          }),
          ...(onPlan ? feeChargeLine(lang, settled) : []),
        ];
  const [first, ...rest] = lines;
  return {
    lang,
    subject: onPlan && by === "client" ? w.SKIPPED_SUBJECT : w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(first!),
      cleanDetails(lang, clean),
      ...[
        ...rest,
        ...refundLine(lang, settled),
        onPlan ? PLAN_CARRIES_ON : bookAnother[lang],
      ].map(paragraph),
      portalButton(lang, jobId),
    ],
  };
};

// everyone on its crew hears it's off
export const crewCancelledEmail = ({
  name,
  clean,
}: {
  name: string;
  clean: Clean;
}): Email => ({
  lang: "en",
  subject: "A job you're on is cancelled",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph("We've cancelled this job. You don't need to go."),
    cleanDetails("en", clean),
    jobsButton,
  ],
});

// the Office hears when a Client cancels or skips a Job themselves
export const officeCancelledEmail = ({
  client,
  jobId,
  clean,
  onPlan,
  late,
  feeCents,
  settled,
}: {
  client: string;
  jobId: string;
  clean: Clean;
  onPlan: boolean;
  late: boolean;
  feeCents: number;
  settled: Settled;
}): Email => ({
  lang: "en",
  subject: onPlan
    ? `${client} skipped a cleaning plan job`
    : `${client} cancelled a job`,
  blocks: [
    paragraph(
      onPlan
        ? `${client} has skipped this job. Their cleaning plan carries on.`
        : `${client} has cancelled this job.`,
    ),
    cleanDetails("en", clean),
    paragraph(
      cancelCostForOffice({
        onPlan,
        late,
        feeCents,
        fee: formatMoney(feeCents),
        weeklyBill: settled.billed,
        failed: settled.failure !== null,
        refund:
          settled.refundedCents > 0 ? formatMoney(settled.refundedCents) : null,
      }),
    ),
    ...(settled.failure ? [paragraph(feeNotPaid(settled.failure))] : []),
    officeButton(jobId),
  ],
});

export const noAccessEmail = (
  lang: Language,
  {
    name,
    jobId,
    clean,
    reason,
    feeCents,
    onPlan,
    settled,
  }: {
    name: string;
    jobId: string;
    clean: Clean;
    // what the Cleaner said happened, as they wrote it
    reason: string;
    feeCents: number;
    onPlan: boolean;
    settled: Settled;
  },
): Email => {
  const w = words[lang].noAccess;
  const { noAccessFee, PLAN_CARRIES_ON } = messages[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.came(reason)),
      cleanDetails(lang, clean),
      ...[
        feeCents === 0
          ? w.NO_CHARGE
          : noAccessFee({ onPlan, fee: formats[lang].formatMoney(feeCents) }),
        ...(onPlan ? feeChargeLine(lang, settled) : []),
        ...refundLine(lang, settled),
        onPlan
          ? `${PLAN_CARRIES_ON} ${w.CHECK_NEXT}`
          : `${bookAnother[lang]} ${w.CHECK_FIRST}`,
      ].map(paragraph),
      portalButton(lang, jobId),
    ],
  };
};

export const officeNoAccessEmail = ({
  cleaner,
  client,
  jobId,
  clean,
  reason,
  onPlan,
  settled,
}: {
  cleaner: string;
  client: string;
  jobId: string;
  clean: Clean;
  reason: string;
  onPlan: boolean;
  settled: Settled;
}): Email => ({
  lang: "en",
  subject: `Couldn't get in at ${clean.address}`,
  blocks: [
    paragraph(`${cleaner} couldn't get in for this job ("${reason}").`),
    cleanDetails("en", clean),
    paragraph(
      onPlan
        ? settled.failure
          ? `${client} has been told. ${feeNotPaid(settled.failure)}`
          : `${client} has been told, and the fee ${feeTaken(settled)}.`
        : `${client} has been told, and the deposit is kept as the fee.`,
    ),
    officeButton(jobId),
  ],
});
