import { proposalEmail } from "../src/features/completion/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang, wednesday } from "./samples.ts";

export default preview(
  proposalEmail(lang, {
    name: client.name,
    jobId,
    clean,
    adjustment: { kind: "extra_time", addOnName: null, hours: 1 },
    reason: "Heavy grease",
    totalCents: 5988,
    answerBy: wednesday,
    reminder: false,
  }),
);
