import { paymentMethodLinkEmail } from "../src/features/payments/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { client, lang } from "./samples.ts";

export default preview(
  paymentMethodLinkEmail(lang, { ...client, weeklyBill: null }),
);
