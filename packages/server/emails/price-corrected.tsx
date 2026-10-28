import { correctedEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, settled } from "./samples.ts";

export default preview(
  correctedEmail({
    name: client.name,
    jobId,
    clean,
    totalCents: 26946,
    owedCents: 0,
    settled: { ...settled, refundedCents: 2994 },
  }),
);
