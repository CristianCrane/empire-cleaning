import { bookingConfirmationEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, lang } from "./samples.ts";

export default preview(
  bookingConfirmationEmail(lang, {
    name: client.name,
    clean,
    paid: {
      depositCents: 5988,
      totalCents: 29940,
      paymentMethod: { brand: "Visa", last4: "4242" },
      weeklyBill: null,
    },
  }),
);
