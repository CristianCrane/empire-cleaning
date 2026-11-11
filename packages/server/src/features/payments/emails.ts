import {
  catalog,
  type BillPayment,
  type Card,
  type Language,
  messages,
} from "@empire-cleaning/models";
import {
  button,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

const words = catalog({
  en: {
    subject: "Add a card for Empire Cleaning",
    // the rest of a clean: on its week's Bill, `billed` saying how that's
    // paid, or charged when it's done
    needCard: (billed: string | null) =>
      `To book your clean we need a card on file. ${billed ? `We take the deposit when you book, and the rest ${billed}.` : "We take the deposit when you book, and the rest when the clean is done."} You add it yourself.`,
    signInWith: (email: string) =>
      `Sign in with this email address (${email}) to add it:`,
    addCard: "Add a card",
  },
  es: {
    subject: "Agregue una tarjeta para Empire Cleaning",
    needCard: (billed: string | null) =>
      `Para reservar su limpieza necesitamos una tarjeta guardada. ${billed ? `Cobramos el depósito al reservar, y el resto ${billed}.` : "Cobramos el depósito al reservar, y el resto cuando la limpieza esté terminada."} La agrega usted.`,
    signInWith: (email: string) =>
      `Inicie sesión con este correo (${email}) para agregarla:`,
    addCard: "Agregar una tarjeta",
  },
});

// A plain link: it carries no sign-in power (ADR-0006). The rest of a
// clean is charged when it's done, or goes on its week's Bill (ADR-0016).
export const paymentMethodLinkEmail = (
  lang: Language,
  {
    name,
    email,
    weeklyBill,
  }: {
    name: string;
    email: string;
    weeklyBill: BillPayment | null;
  },
): Email => {
  const w = words[lang];
  const { billPaid, NEVER_SEE_CARD, ON_WEEKS_BILL } = messages[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(
        `${w.needCard(weeklyBill && `${ON_WEEKS_BILL}, ${billPaid[weeklyBill]}`)} ${NEVER_SEE_CARD}`,
      ),
      paragraph(w.signInWith(email)),
      button(w.addCard, "/portal/payment-method"),
    ],
  };
};

const cardWords = catalog({
  en: { CARD: "card" },
  es: { CARD: "tarjeta" },
});

// a Client's card as an email names it ("Visa ending 4242"), or "card"
// where none is saved to name it by
export const cardOf = (lang: Language, card: Card | null) =>
  card ? messages[lang].card(card) : cardWords[lang].CARD;
