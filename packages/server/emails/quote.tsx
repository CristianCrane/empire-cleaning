import { quoteEmail } from "../src/features/quotes/emails.ts";
import { preview } from "../src/services/email/preview.tsx";
import { address, client, jobId, monday, wednesday } from "./samples.ts";

export default preview(
  quoteEmail({
    ...client,
    quoteId: jobId,
    address,
    offer: {
      number: 1,
      proposedStartsAt: monday.toISOString(),
      expiresAt: wednesday.toISOString(),
      options: [
        {
          serviceName: "Standard Clean",
          recommended: false,
          totalCents: 18000,
        },
        { serviceName: "Deep Clean", recommended: true, totalCents: 29940 },
      ],
      plan: null,
    },
  }),
);
