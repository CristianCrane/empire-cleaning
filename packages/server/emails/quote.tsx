import { quoteEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, lang, monday, wednesday } from "./samples.ts";

export default preview(
  quoteEmail(lang, {
    ...client,
    quoteId: jobId,
    address,
    offer: {
      number: 1,
      proposedStartsAt: monday.toISOString(),
      expiresAt: wednesday.toISOString(),
      options: [
        {
          service: { name: "Standard Clean", nameEs: "Limpieza estándar" },
          recommended: false,
          totalCents: 18000,
        },
        {
          service: { name: "Deep Clean", nameEs: "Limpieza profunda" },
          recommended: true,
          totalCents: 29940,
        },
      ],
      plan: null,
    },
  }),
);
