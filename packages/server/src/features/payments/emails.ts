import {
  button,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";

// A plain link: it carries no sign-in power (ADR-0006)
export const paymentMethodLinkEmail = ({
  name,
  email,
}: {
  name: string;
  email: string;
}): Email => ({
  subject: "Add a Payment Method for Empire Cleaning",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      "To book your clean we need a card on file: we take the Deposit when you book and the rest when the clean is done. You enter it yourself, straight into our payment provider's secure form, so we never see your card number.",
    ),
    paragraph(`Sign in with this email address (${email}) to add it:`),
    button("Add a Payment Method", "/portal/payment-method"),
  ],
});
