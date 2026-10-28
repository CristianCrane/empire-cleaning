import { jobMovedEmail } from "../src/features/reschedule/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, monday, wednesday } from "./samples.ts";

export default preview(
  jobMovedEmail({
    name: client.name,
    jobId,
    clean: { ...clean, startsAt: wednesday },
    from: monday,
  }),
);
