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
      {
        kind: "add_on_done",
        addOnName: "Inside the oven",
        hours: null,
        totalCents: 2994,
      },
      { kind: "extra_time", addOnName: null, hours: 1, totalCents: 5988 },
    ],
    totalCents: 38922,
    rescheduleFeeCents: 0,
    depositCents: 5988,
    owedCents: 32934,
    settled: { ...settled, chargedCents: 32934 },
  }),
);
