import { button, paragraph, type Email } from "../../services/email/blocks.ts";
import { EMAIL_CHANGE_TTL_HOURS } from "./clients.ts";

export const emailChangeEmail = ({ token }: { token: string }): Email => ({
  subject: "Confirm your new email",
  blocks: [
    paragraph(
      "You asked us to send your Quotes and notices to this address. Confirm it's yours:",
    ),
    button("Confirm my email", `/confirm-email?token=${token}`),
    paragraph(
      `The link works for ${EMAIL_CHANGE_TTL_HOURS} hours. If you didn't ask for this, you can ignore this email: nothing changes.`,
    ),
  ],
});
