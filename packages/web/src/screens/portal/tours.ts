import { catalog } from "@empire-cleaning/models";
import type { AreaTours } from "../tours.ts";
import { portalWords } from "./words.ts";

// The Client portal's first-time help (#294): its tours, the first one a
// person meets led by the value line (its wording is with Jennifer, #206),
// in each language. A step's target is the screen's own word, from
// portalWords, so the two can't drift apart
const toursIn = (
  w: (typeof portalWords)["en"],
  t: {
    welcome: string;
    quoteText: string;
    payText: string;
    getInText: string;
    moveText: string;
  },
): AreaTours => ({
  welcomeTitle: w.welcome,
  welcome: t.welcome,
  tours: [
    {
      id: "portal-home-quote",
      route: "/portal/",
      steps: [
        {
          target: { press: w.seeYourQuote },
          title: w.yourQuote,
          text: t.quoteText,
        },
      ],
    },
    {
      id: "portal-quote",
      route: "/portal/quotes/$quoteId",
      // a one-off Quote with a Deposit, as the words say: a Service Plan's
      // Quote is "Pay and start your plan", and one with no Deposit "Book"
      steps: [
        {
          target: { named: w.payAndBook },
          title: w.payAndBook,
          text: t.payText,
        },
      ],
    },
    {
      id: "portal-home-booked",
      route: "/portal/",
      steps: [
        {
          target: { press: w.howWeGetIn },
          title: w.howWeGetIn,
          text: t.getInText,
        },
        {
          // Move or cancel, or Move or skip for a clean on a Service Plan
          target: { press: w.moveOr },
          title: w.anotherTime,
          text: t.moveText,
        },
      ],
    },
  ],
});

const words = catalog({
  en: {
    welcome: "Book, move and pay for your cleans here, no phone calls needed.",
    quoteText:
      "Open it to choose your clean and book. You only pay the deposit today.",
    payText:
      "Pick the clean you want, then pay the deposit to book it. The rest is charged once the clean is done.",
    getInText: "Tell the crew how to get in: gate codes, keys, pets.",
    moveText: "Move your clean from here.",
  },
  es: {
    welcome: "Reserve, reprograme y pague sus limpiezas aquí, sin llamadas.",
    quoteText:
      "Ábrala para elegir su limpieza y reservar. Hoy solo paga el depósito.",
    payText:
      "Elija la limpieza que quiere y pague el depósito para reservarla. El resto se cobra cuando la limpieza esté terminada.",
    getInText:
      "Dígale al equipo cómo entrar: códigos de la puerta, llaves, mascotas.",
    moveText: "Reprograme su limpieza desde aquí.",
  },
});

export const clientTours = {
  en: toursIn(portalWords.en, words.en),
  es: toursIn(portalWords.es, words.es),
};
