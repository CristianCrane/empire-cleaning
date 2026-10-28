import { quoteEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, monday, wednesday } from "./samples.ts";

export default preview(
  quoteEmail({
    ...client,
    quoteId: jobId,
    address,
    offer: {
      number: 2,
      proposedStartsAt: monday.toISOString(),
      expiresAt: wednesday.toISOString(),
      options: [
        {
          serviceName: "Standard Clean",
          recommended: false,
          totalCents: 16200,
        },
        {
          serviceName: "Standard Clean",
          recommended: false,
          totalCents: 16200,
        },
      ],
      plan: {
        recurrence: "weekly",
        discountPercent: 10,
        roundTotalCents: 32400,
        days: [
          {
            serviceName: "Standard Clean",
            startsAt: monday.toISOString(),
            savingCents: 1800,
            oneOffTotalCents: 18000,
          },
          {
            serviceName: "Standard Clean",
            startsAt: wednesday.toISOString(),
            savingCents: 1800,
            oneOffTotalCents: 18000,
          },
        ],
      },
    },
  }),
);
