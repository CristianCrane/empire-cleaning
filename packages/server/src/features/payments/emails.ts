import type { BillPayment } from "@empire-cleaning/models";
import {
  button,
  greeting,
  paragraph,
  type Email,
} from "../../services/email/blocks.ts";
import { firstNameOf } from "../../services/email/format.ts";
import {
  billPaid,
  NEVER_SEE_CARD,
  ON_WEEKS_BILL,
} from "@empire-cleaning/models";

// A plain link: it carries no sign-in power (ADR-0006). The rest of a
// clean is charged when it's done, or goes on its week's Bill (ADR-0016).
export const paymentMethodLinkEmail = ({
  name,
  email,
  weeklyBill,
}: {
  name: string;
  email: string;
  weeklyBill: BillPayment | null;
}): Email => ({
  subject: "Add a card for Empire Cleaning",
  blocks: [
    greeting(firstNameOf(name)),
    paragraph(
      `To book your clean we need a card on file. ${weeklyBill ? `We take the deposit when you book, and the rest ${ON_WEEKS_BILL}, ${billPaid[weeklyBill]}.` : "We take the deposit when you book, and the rest when the clean is done."} You add it yourself. ${NEVER_SEE_CARD}`,
    ),
    paragraph(`Sign in with this email address (${email}) to add it:`),
    button("Add a card", "/portal/payment-method"),
  ],
});
