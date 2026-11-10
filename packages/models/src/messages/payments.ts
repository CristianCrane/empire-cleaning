import type { AdjustmentKind, UnpaidKind } from "../index.ts";
import { formats } from "../format.ts";
import { catalog } from "../language.ts";

// What the server and the screens both say about paying: a card, a payment,
// a refund, and the price changes found when a clean is done
// (docs/ux.md, Words)

type Changed = {
  kind: AdjustmentKind;
  addOnName: string | null;
  hours: number | null;
};

const REFUND_TAKES_DAYS = "It can take a few days to reach you.";
const UPDATE_AND_RETRY = "update your card and we'll try again straight away";
const BOOKED_GO_AHEAD =
  "Cleans already booked still go ahead, but we won't book any more.";

const moreHoursEn = (a: Changed) =>
  `${a.hours} ${formats.en.plural(a.hours!, { one: "more hour", other: "more hours" })}`;

const REFUND_TAKES_DAYS_ES = "Puede tardar unos días en llegarle.";
const UPDATE_AND_RETRY_ES =
  "actualice su tarjeta y lo volvemos a intentar enseguida";
const BOOKED_GO_AHEAD_ES =
  "Las limpiezas ya reservadas siguen en pie, pero no reservaremos más.";

const moreHoursEs = (a: Changed) =>
  `${a.hours} ${formats.es.plural(a.hours!, { one: "hora más", other: "horas más" })}`;

export const payments = catalog({
  en: {
    PRICES_INCLUDE_TAX: "Prices include tax.",
    // a refund, as the Client is told: `amount` already formatted
    REFUND_TAKES_DAYS,
    refundedTo: (amount: string, card: string) =>
      `We've refunded ${amount} to your ${card}. ${REFUND_TAKES_DAYS}`,
    // where a card is typed, as the Client is told
    NEVER_SEE_CARD:
      "It goes straight into our payment service's secure form, so we never see your card number.",
    // a payment we couldn't take, as the Client is told: `amount` already
    // formatted, with what it's for ("$50 for this bill"); `card` null when
    // none is saved; `why` as whyNotPaid gives it
    notTaken: (
      amount: string,
      card: string | null,
      why: string | null = null,
    ) =>
      `We couldn't take ${amount}${card ? ` from your ${card}` : ""}${why ? ` (${why})` : ""}.`,
    // a clean's payment that didn't go through, as its Client is told, for
    // a sentence to end: `day` already formatted
    cleanNotPaid: (day: string) =>
      `We couldn't take payment for your ${day} clean`,
    // how a Client puts right a payment that didn't go through
    UPDATE_AND_RETRY,
    UPDATE_CARD: "Update your card",
    // what happens next, once a payment didn't go through, by why
    clientFix: {
      declined: `Please ${UPDATE_AND_RETRY}.`,
      no_card: "Please add a card and we'll try again straight away.",
      waiting:
        "We'll try again by ourselves, so there's nothing you need to do.",
      late: "Please pay it on its page.",
    } satisfies Record<UnpaidKind, string>,
    // a Client's cleaning plan, paused while a payment on it is Unpaid, and
    // back on once it's paid
    BOOKED_GO_AHEAD,
    PLAN_PAUSED: `Until it's paid, your cleaning plan is paused. ${BOOKED_GO_AHEAD}`,
    PLAN_BACK_ON:
      "Your cleaning plan is back on, and we'll book your cleans as usual.",
    // a fee for a clean that didn't happen, by the Job's status
    feeName: {
      cancelled: "Late cancellation fee",
      no_access: "Couldn't-get-in fee",
    },
    LATE_MOVE_FEE: "Late move fee",
    // what a price change changed, by name: "Inside the fridge", "1 more
    // hour"
    adjustmentItem: (a: Changed) =>
      a.kind === "extra_time" ? moreHoursEn(a) : a.addOnName!,
    // what was reported: "Inside the oven, not done", "1.5 more hours"
    adjustmentLabel: (a: Changed) =>
      a.kind === "extra_time"
        ? moreHoursEn(a)
        : `${a.addOnName}, ${a.kind === "add_on_done" ? "done on the day" : "not done"}`,
  },
  es: {
    PRICES_INCLUDE_TAX: "Los precios incluyen impuestos.",
    REFUND_TAKES_DAYS: REFUND_TAKES_DAYS_ES,
    refundedTo: (amount: string, card: string) =>
      `Le devolvimos ${amount} a su ${card}. ${REFUND_TAKES_DAYS_ES}`,
    NEVER_SEE_CARD:
      "Se escribe directamente en el formulario seguro de nuestro servicio de pagos, así que nunca vemos el número de su tarjeta.",
    notTaken: (
      amount: string,
      card: string | null,
      why: string | null = null,
    ) =>
      `No pudimos cobrar ${amount}${card ? ` de su ${card}` : ""}${why ? ` (${why})` : ""}.`,
    cleanNotPaid: (day: string) =>
      `No pudimos cobrar el pago de su limpieza del ${day}`,
    UPDATE_AND_RETRY: UPDATE_AND_RETRY_ES,
    UPDATE_CARD: "Actualizar tarjeta",
    clientFix: {
      declined: `Por favor, ${UPDATE_AND_RETRY_ES}.`,
      no_card:
        "Por favor, agregue una tarjeta y lo volvemos a intentar enseguida.",
      waiting:
        "Lo volveremos a intentar nosotros, así que usted no tiene que hacer nada.",
      late: "Por favor, páguela en su página.",
    },
    BOOKED_GO_AHEAD: BOOKED_GO_AHEAD_ES,
    PLAN_PAUSED: `Hasta que se pague, su plan de limpieza está en pausa. ${BOOKED_GO_AHEAD_ES}`,
    PLAN_BACK_ON:
      "Su plan de limpieza está activo de nuevo, y reservaremos sus limpiezas como siempre.",
    feeName: {
      cancelled: "Cargo por cancelación tardía",
      no_access: "Cargo por no poder entrar",
    },
    LATE_MOVE_FEE: "Cargo por reprogramación tardía",
    adjustmentItem: (a: Changed) =>
      a.kind === "extra_time" ? moreHoursEs(a) : a.addOnName!,
    adjustmentLabel: (a: Changed) =>
      a.kind === "extra_time"
        ? moreHoursEs(a)
        : `${a.addOnName}, ${a.kind === "add_on_done" ? "se hizo ese día" : "no se hizo"}`,
  },
});

// what happens next, once a payment didn't go through, as the Office reads
// it, in English (ADR-0025)
export const officeFix: Record<UnpaidKind, string> = {
  declined: "We've emailed the client to update their card, which tries again.",
  no_card: "We've emailed the client to add a card, which tries again.",
  waiting: "We'll try again by ourselves.",
  late: "We remind the client each week until it's paid.",
};
