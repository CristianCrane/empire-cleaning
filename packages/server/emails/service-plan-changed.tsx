import { planChangeEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, monday, wednesday } from "./samples.ts";

export default preview(
  planChangeEmail({
    name: client.name,
    address,
    planId: jobId,
    plan: {
      recurrence: "weekly",
      cleans: [
        { startsAt: monday, serviceName: "Standard Clean", totalCents: 16200 },
        {
          startsAt: wednesday,
          serviceName: "Standard Clean",
          totalCents: 16200,
        },
      ],
    },
    replaced: [monday],
    // a business billed weekly, as most plans of several days a week are
    paid: { paymentMethod: "Visa ending 4242", weeklyBill: "automatic" },
  }),
);
