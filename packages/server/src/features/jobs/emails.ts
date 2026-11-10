import { catalog, type Language } from "@empire-cleaning/models";
import {
  button,
  cleanDetails,
  greeting,
  paragraph,
  type Clean,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

// what any email about a coming clean asks of its Client, in their
// language
export const getInWords = catalog({
  en: {
    // a clean coming up, as its Client is reminded, and how they put right
    // how we get in; the caller ends the sentence
    CAN_GET_IN:
      "Please make sure our team can get in. If anything has changed, such as a gate code or where the key is, update how we get in",
    CHECK_GET_IN: "Check how we get in",
  },
  es: {
    CAN_GET_IN:
      "Por favor, asegúrese de que nuestro equipo pueda entrar. Si algo cambió, como el código de la puerta o dónde está la llave, actualice cómo entramos",
    CHECK_GET_IN: "Revisar cómo entramos",
  },
});

// where a Client puts it right, from any email that asks them to check it
export const accessButton = (lang: Language) =>
  button(getInWords[lang].CHECK_GET_IN, "/portal/details");

const words = catalog({
  en: {
    subject: "Your clean is tomorrow",
    reminder: "A reminder that your clean is tomorrow.",
  },
  es: {
    subject: "Su limpieza es mañana",
    reminder: "Le recordamos que su limpieza es mañana.",
  },
});

export const reminderEmail = (
  lang: Language,
  { name, clean }: { name: string; clean: Clean },
): Email => {
  const w = words[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.reminder),
      cleanDetails(lang, clean),
      paragraph(`${getInWords[lang].CAN_GET_IN}:`),
      accessButton(lang),
    ],
  };
};
