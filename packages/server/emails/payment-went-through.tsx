import { paymentWentThroughEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang, settled } from "./samples.ts";

export default preview(
  paymentWentThroughEmail(lang, {
    name: client.name,
    jobId,
    clean,
    owedCents: 0,
    settled: { ...settled, chargedCents: 12104, plan: "resumed" },
  }),
);
