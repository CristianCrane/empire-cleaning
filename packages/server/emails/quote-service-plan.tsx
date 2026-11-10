import { quoteEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, lang, monday, wednesday } from "./samples.ts";

export default preview(
  quoteEmail(lang, {
    ...client,
    quoteId: jobId,
    address,
    offer: {
      number: 2,
      proposedStartsAt: monday.toISOString(),
      expiresAt: wednesday.toISOString(),
      options: [
        {
          service: { name: "Standard Clean", nameEs: "Limpieza estándar" },
          recommended: false,
          totalCents: 16200,
        },
        {
          service: { name: "Standard Clean", nameEs: "Limpieza estándar" },
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
            service: { name: "Standard Clean", nameEs: "Limpieza estándar" },
            startsAt: monday.toISOString(),
            savingCents: 1800,
            oneOffTotalCents: 18000,
          },
          {
            service: { name: "Standard Clean", nameEs: "Limpieza estándar" },
            startsAt: wednesday.toISOString(),
            savingCents: 1800,
            oneOffTotalCents: 18000,
          },
        ],
      },
    },
  }),
);
