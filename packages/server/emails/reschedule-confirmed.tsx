import { rescheduleConfirmedEmail } from "../src/features/reschedule/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { clean, client, jobId, lang, monday, wednesday } from "./samples.ts";

export default preview(
  rescheduleConfirmedEmail(lang, {
    name: client.name,
    jobId,
    clean: { ...clean, startsAt: wednesday },
    from: monday,
    cost: {
      cost: "free_late",
      feeCents: 0,
      onPlan: false,
      weeklyBill: false,
    },
  }),
);
