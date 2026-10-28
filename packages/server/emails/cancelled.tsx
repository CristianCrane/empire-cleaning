import { cancelledEmail } from "../src/features/cancellation/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, settled } from "./samples.ts";

export default preview(
  cancelledEmail({
    name: client.name,
    jobId,
    clean,
    by: "client",
    reason: null,
    onPlan: false,
    late: false,
    feeCents: 0,
    settled: { ...settled, refundedCents: 5988 },
    cutoffHours: 24,
  }),
);
