import { catalog, type Language } from "@empire-cleaning/models";
import { button, paragraph, type Email } from "../../services/email/blocks.ts";
import { EMAIL_CHANGE_TTL_HOURS } from "./clients.ts";

const words = catalog({
  en: {
    subject: "Confirm your new email",
    asked:
      "You asked us to send your quotes and notices to this address. Confirm it's yours:",
    confirm: "Confirm my email",
    works: (hours: number) =>
      `The link works for ${hours} hours. If you didn't ask for this, you can ignore this email: nothing changes.`,
  },
  es: {
    subject: "Confirme su nuevo correo",
    asked:
      "Nos pidió enviar sus cotizaciones y avisos a esta dirección. Confirme que es suya:",
    confirm: "Confirmar mi correo",
    works: (hours: number) =>
      `El enlace funciona durante ${hours} horas. Si usted no pidió esto, puede ignorar este correo: no cambia nada.`,
  },
});

// its link's page opens in the same language (?lang, as the landing site's
// links say it)
export const emailChangeEmail = (
  lang: Language,
  { token }: { token: string },
): Email => {
  const w = words[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      paragraph(w.asked),
      button(w.confirm, `/confirm-email?token=${token}&lang=${lang}`),
      paragraph(w.works(EMAIL_CHANGE_TTL_HOURS)),
    ],
  };
};
