import { bookingConfirmationEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client } from "./samples.ts";

export default preview(
  bookingConfirmationEmail({
    name: client.name,
    clean,
    paid: {
      depositCents: 5988,
      totalCents: 29940,
      paymentMethod: "Visa ending 4242",
    },
  }),
);
