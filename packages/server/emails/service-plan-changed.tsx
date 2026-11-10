import { planChangeEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, lang, monday, wednesday } from "./samples.ts";

export default preview(
  planChangeEmail(lang, {
    name: client.name,
    address,
    planId: jobId,
    plan: {
      recurrence: "weekly",
      cleans: [
        {
          startsAt: monday,
          service: { name: "Standard Clean", nameEs: "Limpieza estándar" },
          totalCents: 16200,
        },
        {
          startsAt: wednesday,
          service: { name: "Standard Clean", nameEs: "Limpieza estándar" },
          totalCents: 16200,
        },
      ],
    },
    replaced: [monday],
    // a business billed weekly, as most plans of several days a week are
    paid: {
      paymentMethod: { brand: "Visa", last4: "4242" },
      weeklyBill: "automatic",
    },
  }),
);
