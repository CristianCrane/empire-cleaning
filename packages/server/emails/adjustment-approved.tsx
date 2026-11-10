import { approvedEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang, settled } from "./samples.ts";

export default preview(
  approvedEmail(lang, {
    name: client.name,
    jobId,
    clean,
    adjustment: { kind: "extra_time", addOnName: null, hours: 1 },
    amountCents: 5988,
    totalCents: 35928,
    owedCents: 5988,
    settled: { ...settled, chargedCents: 5988 },
  }),
);
