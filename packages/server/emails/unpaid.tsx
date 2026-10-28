import { unpaidEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId } from "./samples.ts";

export default preview(
  unpaidEmail({
    name: client.name,
    jobId,
    clean,
    owedCents: 32934,
    paymentMethod: "Visa ending 4242",
    held: true,
  }),
);
