import { officePlanEndedEmail } from "../src/features/service-plans/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, monday, wednesday } from "./samples.ts";

export default preview(
  officePlanEndedEmail({
    client: client.name,
    address,
    planId: jobId,
    terms: {
      cancelled: [wednesday.toISOString()],
      goingAhead: [monday.toISOString()],
    },
  }),
);
