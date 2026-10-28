import { planConfirmationEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, monday, wednesday } from "./samples.ts";

export default preview(
  planConfirmationEmail({
    name: client.name,
    address,
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
    paid: {
      depositCents: 5046,
      totalCents: 16200,
      paymentMethod: "Visa ending 4242",
    },
  }),
);
