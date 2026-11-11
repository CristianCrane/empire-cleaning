import { unpaidEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang } from "./samples.ts";

export default preview(
  unpaidEmail(lang, {
    name: client.name,
    jobId,
    clean,
    owedCents: 32934,
    paymentMethod: { brand: "Visa", last4: "4242" },
    held: true,
  }),
);
