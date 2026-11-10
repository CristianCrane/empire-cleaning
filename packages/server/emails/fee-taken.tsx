import { feeTakenEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang, settled } from "./samples.ts";

export default preview(
  feeTakenEmail(lang, {
    name: client.name,
    jobId,
    clean,
    feeCents: 5046,
    owedCents: 5046,
    settled: { ...settled, chargedCents: 5046 },
  }),
);
