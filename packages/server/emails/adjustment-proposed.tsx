import { proposalEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, wednesday } from "./samples.ts";

export default preview(
  proposalEmail({
    name: client.name,
    jobId,
    clean,
    label: "1 extra hour",
    reason: "Heavy grease",
    totalCents: 5988,
    answerBy: wednesday,
    reminder: false,
  }),
);
