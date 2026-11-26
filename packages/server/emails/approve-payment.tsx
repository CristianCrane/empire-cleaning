import { unpaidEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang } from "./samples.ts";

// a clean's payment, charged without the Client there, that their bank
// wants them to approve on its page (#534 Q7)
export default preview(
  unpaidEmail(lang, {
    name: client.name,
    jobId,
    clean,
    owedCents: 32934,
    paymentMethod: { brand: "Visa", last4: "4242" },
    held: true,
    approve: true,
  }),
);
