import { noAccessEmail } from "../src/features/cancellation/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, settled } from "./samples.ts";

export default preview(
  noAccessEmail({
    name: client.name,
    jobId,
    clean,
    reason: "Nobody home and the gate was locked",
    feeCents: 5988,
    onPlan: false,
    settled,
  }),
);
