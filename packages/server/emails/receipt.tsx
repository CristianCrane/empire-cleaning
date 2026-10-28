import { receiptEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, settled } from "./samples.ts";

export default preview(
  receiptEmail({
    name: client.name,
    jobId,
    clean,
    quotedCents: 29940,
    adjustments: [
      { label: "Inside the oven, done on the day", totalCents: 2994 },
      { label: "1 extra hour", totalCents: 5988 },
    ],
    totalCents: 38922,
    rescheduleFeeCents: 0,
    depositCents: 5988,
    owedCents: 32934,
    settled: { ...settled, chargedCents: 32934 },
  }),
);
