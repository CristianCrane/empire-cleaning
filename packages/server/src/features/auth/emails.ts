import { catalog, type Language } from "@empire-cleaning/models";
import { button, paragraph, type Email } from "../../services/email/blocks.ts";

const words = catalog({
  en: {
    subject: "Sign in to Empire Cleaning",
    useLink: "Use this link to sign in to Empire Cleaning:",
    signIn: "Sign in",
    expires:
      "It expires in 15 minutes. If you didn't ask to sign in, you can ignore this email.",
  },
  es: {
    subject: "Inicie sesión en Empire Cleaning",
    useLink: "Use este enlace para iniciar sesión en Empire Cleaning:",
    signIn: "Iniciar sesión",
    expires:
      "Vence en 15 minutos. Si usted no pidió iniciar sesión, puede ignorar este correo.",
  },
});

// in the language of the screen it was asked from: the person may have no
// Client or Staff member yet. `path`: the link's page in the web app
export const signInEmail = (
  lang: Language,
  { path }: { path: string },
): Email => {
  const w = words[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      paragraph(w.useLink),
      button(w.signIn, path),
      paragraph(w.expires),
    ],
  };
};
