import { rescheduleConfirmedEmail } from "../src/features/reschedule/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, monday, wednesday } from "./samples.ts";

export default preview(
  rescheduleConfirmedEmail({
    ...{
      name: client.name,
      jobId,
      clean: { ...clean, startsAt: wednesday },
      from: monday,
    },
    cost: "free_late",
    feeCents: 0,
    onPlan: false,
    lateHours: 24,
  }),
);
