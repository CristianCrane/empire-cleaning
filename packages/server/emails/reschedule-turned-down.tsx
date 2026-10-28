import { rescheduleTurnedDownEmail } from "../src/features/reschedule/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, wednesday } from "./samples.ts";

export default preview(
  rescheduleTurnedDownEmail({
    name: client.name,
    jobId,
    clean,
    asked: wednesday,
    reason: "We're fully booked that morning.",
  }),
);
