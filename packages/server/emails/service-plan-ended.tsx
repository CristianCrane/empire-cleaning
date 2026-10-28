import { planEndedEmail } from "../src/features/service-plans/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import {
  address,
  client,
  jobId,
  monday,
  settled,
  wednesday,
} from "./samples.ts";

export default preview(
  planEndedEmail({
    name: client.name,
    address,
    planId: jobId,
    terms: {
      cancelled: [wednesday.toISOString()],
      goingAhead: [monday.toISOString()],
      depositCents: 5046,
      deposit: "comes_off",
      finalJob: { id: jobId, startsAt: monday.toISOString(), status: "booked" },
    },
    settled,
    cutoffHours: 24,
  }),
);
