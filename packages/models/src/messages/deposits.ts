import type { QuoteView } from "../index.ts";
import { formats, theTimeEs } from "../format.ts";
import { catalog, type Language } from "../language.ts";
import { NEW_QUOTE_EN, NEW_QUOTE_ES } from "./quotes.ts";

// What the Client is told of their Deposit payment on a Quote (#534), by
// the server answering a press and by the Quote's pages and Home reading
// where it stands (DepositPaying): one wording for each state, as only one
// exists for each, in the words a Bill's payment has where they mean the
// same (bills.ts). `goal` is what booking it does: books a one-off Quote's
// clean, starts a plan, or changes the home's plan (a card entered to
// accept it, with nothing charged)

export type DepositGoal = "clean" | "plan" | "change";

// what booking it does, after "to", with the Service paid for on a clean
const goalEn = (goal: DepositGoal, service: string | null) =>
  ({
    clean: `book your ${service ?? "clean"}`,
    plan: "start your plan",
    change: "change your plan",
  })[goal];
const goalEs = (goal: DepositGoal, service: string | null) =>
  ({
    clean: `reservar su ${service ?? "limpieza"}`,
    plan: "empezar su plan",
    change: "cambiar su plan",
  })[goal];
// the button that starts over, as each quote's page names it: a card
// entered with nothing charged accepts without paying
const startOverEn = (goal: DepositGoal) =>
  goal === "change" ? "Accept the new terms" : "Accept and book";
const startOverEs = (goal: DepositGoal) =>
  goal === "change" ? "Aceptar las nuevas condiciones" : "Aceptar y reservar";

// while it books: the clean or plan they'll be emailed about. The
// booking's own email is sent once it books; the Clock books one whose
// event never came on its next run past 15 minutes, so half an hour, as
// the Bill's card payment says
const bookedEn = {
  clean: "your clean is booked",
  plan: "your plan is booked",
  change: "your plan is changed",
};
const bookedEs = {
  clean: "su limpieza quede reservada",
  plan: "su plan quede reservado",
  change: "su plan cambie",
};
const emailEn = (goal: DepositGoal) =>
  `We'll email you as soon as ${bookedEn[goal]}, usually within half an hour.`;
const emailEs = (goal: DepositGoal) =>
  `Le enviaremos un correo en cuanto ${bookedEs[goal]}, normalmente en menos de media hora.`;
// what's still going on: their bank finishing a payment, or approving a
// card saved with nothing charged (a 0% Deposit)
const finishingEn = (card: boolean) =>
  card
    ? "Your bank is still finishing approving your card"
    : "Your payment is still going through with your bank";
const finishingEs = (card: boolean) =>
  card
    ? "Su banco aún está terminando de aprobar su tarjeta"
    : "Su pago aún no termina de pasar con su banco";

// their bank approved what couldn't then be booked: a Deposit, refunded,
// or a card saved with nothing charged (a 0% Deposit), each in its own words
// so neither says the other's
const whileEn = (card: boolean) =>
  `while your bank was approving ${card ? "your card" : "the payment"}`;
const whileEs = (card: boolean) =>
  `mientras su banco aprobaba ${card ? "su tarjeta" : "el pago"}`;
const soEn = (card: boolean) =>
  card ? "so nothing was booked" : "so we've refunded your deposit";
const soEs = (card: boolean) =>
  card ? "así que no se reservó nada" : "así que le devolvimos el depósito";

export const deposits = catalog({
  en: {
    // their bank is finishing it, with nothing to approve: a first press
    // (#534's F21), or the page coming back to it
    depositFinishing: emailEn,
    // pressed again from a page opened before it: nothing more was taken
    depositProcessing: (goal: DepositGoal, card: boolean) =>
      card
        ? `${finishingEn(card)}, so nothing is booked twice. ${emailEn(goal)}`
        : `Your first payment is still going through with your bank, so nothing more was charged. ${emailEn(goal)}`,
    // Decline pressed meanwhile: too far on to call off, it may still book
    // the quote (#534's UX design, Screen 1c)
    depositNoDecline: (goal: DepositGoal, card: boolean) =>
      `${finishingEn(card)}, so this quote can't be declined now. ${emailEn(goal)}`,
    // their bank asking them to approve it, till `until` (formatted), when
    // it's called off; pressing again starts over, calling it off
    depositWaiting: (p: {
      goal: DepositGoal;
      service: string | null;
      until: string;
    }) =>
      `Your bank hasn't approved your payment yet. Approve it in your bank's app by ${p.until} to ${goalEn(p.goal, p.service)}, or press Accept and pay to start over: you're only charged once.`,
    // or approve saving a card entered with nothing to charge, held and
    // called off as a payment is
    cardWaiting: (p: {
      goal: DepositGoal;
      service: string | null;
      until: string;
    }) =>
      `Your bank hasn't approved your card yet. Approve it in your bank's app by ${p.until} to ${goalEn(p.goal, p.service)}, or press ${startOverEn(p.goal)} to start over. Nothing is charged.`,
    // the same, as a line under a quote's card on Home
    DEPOSIT_WAITING_LINE: "Your bank hasn't approved your payment yet.",
    CARD_WAITING_LINE: "Your bank hasn't approved your card yet.",
    depositNotApproved: (card: boolean) =>
      card
        ? "Your card wasn't approved, so nothing was booked. Please try again, or use another card."
        : "Your payment wasn't approved, so nothing was taken. Please try again, or use another card.",
    // `why`, the payment service's reason, as a Bill's payment says it
    depositFailed: (card: boolean, why: string | null) =>
      card
        ? `Your card was declined${why ? ` (${why})` : ""}, so nothing was booked. Please try again, or use another card.`
        : `Your payment didn't go through${why ? ` (${why})` : ""}. Please try again, or use another card.`,
    depositNoRoom: (card: boolean) =>
      card
        ? `Sorry, that time got booked up ${whileEn(card)}, ${soEn(card)}. ${NEW_QUOTE_EN}`
        : `Sorry, that time got booked up ${whileEn(card)}. We've refunded your deposit. ${NEW_QUOTE_EN}`,
    // its Service's time filled while another option still fits then
    depositNoRoomFor: (card: boolean, service: string, other: string) =>
      `Sorry, that time got booked up for the ${service} ${whileEn(card)}, ${soEn(card)}. The ${other} can still be booked then.`,
    depositRevised: (card: boolean) =>
      `This quote was updated ${whileEn(card)}, ${soEn(card)}. Please take a look at what's changed.`,
    depositExpired: (card: boolean) =>
      `This quote expired ${whileEn(card)}, ${soEn(card)}.`,
    depositTurnedDown: (card: boolean) =>
      card
        ? "We couldn't take this one on, so nothing was booked."
        : "We couldn't take this one on, so we've refunded the deposit you paid while your bank was approving it.",
    depositClosed: (card: boolean) =>
      `This quote closed ${whileEn(card)}, ${soEn(card)}.`,
    // the home's plan started or changed meanwhile: one open plan quote per
    // home makes it unreachable today, but the server still checks it
    depositPlanMoved: (card: boolean) =>
      `Your cleaning plan started ${whileEn(card)}, ${soEn(card)}.`,
  },
  es: {
    depositFinishing: emailEs,
    depositProcessing: (goal: DepositGoal, card: boolean) =>
      card
        ? `${finishingEs(card)}, así que nada se reserva dos veces. ${emailEs(goal)}`
        : `Su primer pago aún no termina de pasar con su banco, así que no se cobró nada más. ${emailEs(goal)}`,
    depositNoDecline: (goal: DepositGoal, card: boolean) =>
      `${finishingEs(card)}, así que esta cotización no se puede rechazar ahora. ${emailEs(goal)}`,
    depositWaiting: (p: {
      goal: DepositGoal;
      service: string | null;
      until: string;
    }) =>
      `Su banco aún no ha aprobado su pago. Apruébelo en la app de su banco antes de ${theTimeEs(p.until)} para ${goalEs(p.goal, p.service)}, o presione Aceptar y pagar para empezar de nuevo: solo se le cobra una vez.`,
    cardWaiting: (p: {
      goal: DepositGoal;
      service: string | null;
      until: string;
    }) =>
      `Su banco aún no ha aprobado su tarjeta. Apruébela en la app de su banco antes de ${theTimeEs(p.until)} para ${goalEs(p.goal, p.service)}, o presione ${startOverEs(p.goal)} para empezar de nuevo. No se cobra nada.`,
    DEPOSIT_WAITING_LINE: "Su banco aún no ha aprobado su pago.",
    CARD_WAITING_LINE: "Su banco aún no ha aprobado su tarjeta.",
    depositNotApproved: (card: boolean) =>
      card
        ? "Su tarjeta no se aprobó, así que no se reservó nada. Vuelva a intentarlo, o use otra tarjeta."
        : "Su pago no se aprobó, así que no se cobró nada. Vuelva a intentarlo, o use otra tarjeta.",
    depositFailed: (card: boolean, why: string | null) =>
      card
        ? `Su tarjeta fue rechazada${why ? ` (${why})` : ""}, así que no se reservó nada. Vuelva a intentarlo, o use otra tarjeta.`
        : `Su pago no pasó${why ? ` (${why})` : ""}. Vuelva a intentarlo, o use otra tarjeta.`,
    depositNoRoom: (card: boolean) =>
      card
        ? `Lo sentimos, esa hora se llenó ${whileEs(card)}, ${soEs(card)}. ${NEW_QUOTE_ES}`
        : `Lo sentimos, esa hora se llenó ${whileEs(card)}. Le devolvimos el depósito. ${NEW_QUOTE_ES}`,
    depositNoRoomFor: (card: boolean, service: string, other: string) =>
      `Lo sentimos, esa hora se llenó para la ${service} ${whileEs(card)}, ${soEs(card)}. La ${other} aún se puede reservar a esa hora.`,
    depositRevised: (card: boolean) =>
      `Esta cotización se actualizó ${whileEs(card)}, ${soEs(card)}. Revise lo que cambió.`,
    depositExpired: (card: boolean) =>
      `Esta cotización venció ${whileEs(card)}, ${soEs(card)}.`,
    depositTurnedDown: (card: boolean) =>
      card
        ? "No pudimos aceptar este trabajo, así que no se reservó nada."
        : "No pudimos aceptar este trabajo, así que le devolvimos el depósito que pagó mientras su banco lo aprobaba.",
    depositClosed: (card: boolean) =>
      `Esta cotización se cerró ${whileEs(card)}, ${soEs(card)}.`,
    depositPlanMoved: (card: boolean) =>
      `Su plan de limpieza empezó ${whileEs(card)}, ${soEs(card)}.`,
  },
});

// what booking a Quote does, as its Client is told while their Deposit
// goes through: changing the plan their home has, starting one, or
// booking a clean
export const depositGoalOf = (
  quote: Pick<QuoteView, "kind" | "changesPlan">,
): DepositGoal =>
  quote.kind === "one_off" ? "clean" : quote.changesPlan ? "change" : "plan";

// What a Client's Quote page says of their latest Deposit payment on it, in
// its alert, and what pressing Accept answers once the payment stands
// there, in the same words (#534's UX design, Screen 1d: one wording for
// each state): going through, their bank asking them to approve it, or how
// it ended without booking it; null when there's none. The Quote as its
// page holds it: `bookable` says whether a refund for a time that filled
// leaves another Service, and `options` name each by its key
export type DepositAlert = {
  tone: "info" | "warning" | "danger";
  text: string;
};
export const depositAlertOf = (
  lang: Language,
  quote: Pick<
    QuoteView,
    "kind" | "status" | "bookable" | "paying" | "options" | "changesPlan"
  >,
): DepositAlert | null => {
  const said = deposits[lang];
  const { paying } = quote;
  if (!paying) return null;
  const nameOf = (key: string) =>
    quote.options.find((o) => o.serviceKey === key)?.serviceName;
  // a card saved with nothing charged (a 0% Deposit) says what was booked,
  // as nothing was to be taken
  const card = paying.depositCents === 0;
  const goal = depositGoalOf(quote);
  switch (paying.status) {
    case "goingThrough":
      return { tone: "info", text: said.depositFinishing(goal) };
    case "approving": {
      const waiting = {
        goal,
        service: goal === "clean" ? (nameOf(paying.serviceKey) ?? null) : null,
        until: formats[lang].formatTime(paying.until),
      };
      return {
        tone: "warning",
        text: card ? said.cardWaiting(waiting) : said.depositWaiting(waiting),
      };
    }
    case "notApproved":
      return { tone: "info", text: said.depositNotApproved(card) };
    case "failed":
      return { tone: "danger", text: said.depositFailed(card, paying.why) };
    case "refunded":
      break;
  }
  const text = (() => {
    switch (paying.why) {
      case "no_room": {
        const other = quote.kind === "one_off" ? quote.bookable[0] : undefined;
        const service = nameOf(paying.serviceKey);
        const instead = other && nameOf(other);
        return service && instead
          ? said.depositNoRoomFor(card, service, instead)
          : said.depositNoRoom(card);
      }
      case "revised":
        return said.depositRevised(card);
      case "closed":
        return quote.status === "expired"
          ? said.depositExpired(card)
          : quote.status === "turned_down"
            ? said.depositTurnedDown(card)
            : said.depositClosed(card);
      case "has_plan":
      case "plan_changed":
        return said.depositPlanMoved(card);
    }
  })();
  return { tone: "info", text };
};
