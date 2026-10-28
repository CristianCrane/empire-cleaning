import { button, paragraph, type Email } from "../../services/email/blocks.ts";

export const signInEmail = ({ url }: { url: string }): Email => ({
  subject: "Sign in to Empire Cleaning",
  blocks: [
    paragraph("Use this link to sign in to Empire Cleaning:"),
    button("Sign in", url),
    paragraph(
      "It expires in 15 minutes. If you didn't ask to sign in, you can ignore this email.",
    ),
  ],
});
