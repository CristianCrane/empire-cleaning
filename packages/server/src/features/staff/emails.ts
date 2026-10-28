import {
  button,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

// the link only leads to the sign-in page: signing up with this email is what
// connects them, so the email itself grants nothing (ADR-0006)
export const staffInviteEmail = ({
  name,
  email,
}: {
  name: string;
  email: string;
}): Email => ({
  subject: "You're invited to join Empire Cleaning",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `You've been invited to join Empire Cleaning's Staff. To get started, sign up with this email address (${email}), with an emailed link or with Google:`,
    ),
    button("Sign up", "/sign-in"),
    paragraph("If you weren't expecting this, you can ignore this email."),
  ],
});
