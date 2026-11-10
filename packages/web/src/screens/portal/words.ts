import { catalog } from "@empire-cleaning/models";

// The Client portal's words that more than one of its files shows (its
// navigation, breadcrumbs, shortcuts and tours), in English and Spanish
// (ADR-0025), usted to Clients. A word only one screen shows is in that
// screen's own catalog. The Spanish is a draft the owner checks (#206).
export const portalWords = catalog({
  en: {
    home: "Home",
    cleans: "Cleans",
    payments: "Payments",
    yourDetails: "Your details",
    howWeGetIn: "How we get in",
    payAndBook: "Pay and book",
    seeYourQuote: "See your quote",
    yourQuote: "Your quote",
    moveOrCancel: "Move or cancel",
    moveOrSkip: "Move or skip",
    // what Move or cancel and Move or skip both start with
    moveOr: "Move or",
    yourCard: "Your card",
    yourPlan: "Your cleaning plan",
    seeYourPlan: "See your plan",
    cancel: "Cancel",
    tryAgain: "Please try again.",
  },
  es: {
    home: "Inicio",
    cleans: "Limpiezas",
    payments: "Pagos",
    yourDetails: "Sus datos",
    howWeGetIn: "Cómo entramos",
    payAndBook: "Pagar y reservar",
    seeYourQuote: "Ver su cotización",
    yourQuote: "Su cotización",
    moveOrCancel: "Reprogramar o cancelar",
    moveOrSkip: "Reprogramar o saltar",
    moveOr: "Reprogramar",
    yourCard: "Su tarjeta",
    yourPlan: "Su plan de limpieza",
    seeYourPlan: "Ver su plan",
    cancel: "Cancelar",
    tryAgain: "Vuelva a intentarlo.",
  },
});
