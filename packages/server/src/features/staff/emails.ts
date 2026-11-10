import { catalog, type Language } from "@empire-cleaning/models";
import {
  button,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

// in the invitee's Preferred Language, which the Office sets as it invites
// them; tú in Spanish, a draft the owner checks (#206)
const words = catalog({
  en: {
    subject: "You're invited to join Empire Cleaning",
    invited: (email: string) =>
      `You've been invited to join Empire Cleaning's staff. To get started, sign up with this email address (${email}), with an emailed link or with Google:`,
    SIGN_UP: "Sign up",
    IGNORE: "If you weren't expecting this, you can ignore this email.",
  },
  es: {
    subject: "Te invitamos a unirte a Empire Cleaning",
    invited: (email: string) =>
      `Te invitamos a unirte al equipo de Empire Cleaning. Para empezar, regístrate con este correo (${email}), con un enlace por correo o con Google:`,
    SIGN_UP: "Registrarte",
    IGNORE: "Si no esperabas este correo, puedes ignorarlo.",
  },
});

// the link only leads to the sign-in page: signing up with this email is what
// connects them, so the email itself grants nothing (ADR-0006)
export const staffInviteEmail = (
  lang: Language,
  { name, email }: { name: string; email: string },
): Email => {
  const w = words[lang];
  return {
    lang,
    subject: w.subject,
    blocks: [
      greeting(firstNameOf(name)),
      paragraph(w.invited(email)),
      button(w.SIGN_UP, "/sign-in"),
      paragraph(w.IGNORE),
    ],
  };
};
